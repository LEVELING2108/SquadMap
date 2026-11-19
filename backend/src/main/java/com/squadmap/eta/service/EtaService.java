package com.squadmap.eta.service;

import com.squadmap.common.geo.GeoMath;
import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimitedException;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.common.security.Caller;
import com.squadmap.eta.domain.Eta;
import com.squadmap.eta.domain.Route;
import com.squadmap.eta.domain.TravelMode;
import com.squadmap.eta.dto.EtaView;
import com.squadmap.location.domain.Position;
import com.squadmap.location.service.LiveChannel;
import com.squadmap.location.service.LiveTrips;
import com.squadmap.location.service.PositionStore;
import com.squadmap.location.service.TripAccess;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import org.springframework.http.HttpStatus;
import com.squadmap.trip.domain.Destination;
import com.squadmap.trip.domain.Trip;
import com.squadmap.trip.domain.TripMember;
import com.squadmap.trip.repo.TripMemberRepository;
import com.squadmap.trip.repo.TripRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Works out how far each member has to go and when they will arrive, and notices when they arrive.
 * Runs after each location update, in the background. Mapbox Directions is a paid API, so a route is only
 * asked for when it has changed enough to matter, shared between people starting from the same spot, and
 * capped per trip; otherwise the ETA is estimated.
 */
@Service
public class EtaService {

    /** Within this distance of the destination... */
    public static final double ARRIVAL_RADIUS_M = 60;
    /** ...for this long counts as arrived, so passing by on the way doesn't. */
    public static final Duration ARRIVAL_DWELL = Duration.ofSeconds(20);
    /** Roads wind: a straight line is about this much shorter than the way there. */
    static final double DETOUR = 1.3;

    private static final Logger log = LoggerFactory.getLogger(EtaService.class);

    private final TripRepository trips;
    private final TripMemberRepository members;
    private final EtaStore store;
    private final MapboxDirections directions;
    private final RateLimiter rateLimiter;
    private final LiveChannel channel;
    private final LiveTrips liveTrips;
    private final TransactionTemplate transactions;
    private final TripAccess access;
    private final PositionStore positions;
    private final Clock clock;

    public EtaService(TripRepository trips, TripMemberRepository members, EtaStore store,
                      MapboxDirections directions, RateLimiter rateLimiter, LiveChannel channel,
                      LiveTrips liveTrips, TransactionTemplate transactions, TripAccess access,
                      PositionStore positions, Clock clock) {
        this.access = access;
        this.positions = positions;
        this.trips = trips;
        this.members = members;
        this.store = store;
        this.directions = directions;
        this.rateLimiter = rateLimiter;
        this.channel = channel;
        this.liveTrips = liveTrips;
        this.transactions = transactions;
        this.clock = clock;
    }

    /**
     * Everyone's current ETA on the trip, for the map's first load and after a reconnect. Members with no
     * ETA (not sharing, arrived, no spot yet, or no destination) are left out.
     */
    @Transactional(readOnly = true)
    public List<EtaView> snapshot(UUID tripId, Caller caller) {
        access.requireMember(tripId, caller);
        List<UUID> ids = members.findByTripIdAndLeftAtIsNullOrderByJoinedAt(tripId).stream()
                .filter(member -> member.getArrivedAt() == null)
                .map(TripMember::getId)
                .toList();
        Map<UUID, Eta> found = store.getAll(tripId, ids);
        return ids.stream().filter(found::containsKey).map(id -> EtaView.of(found.get(id))).toList();
    }

    /**
     * Records how the caller is travelling and, if they have a spot, works out their ETA again straight away
     * so everyone sees the new route and time.
     *
     * @throws ApiException 400 {@code VALIDATION_FAILED} for anything but car, bike or walk
     */
    public void chooseMode(UUID tripId, Caller caller, String mode) {
        TravelMode chosen;
        try {
            chosen = TravelMode.valueOf(mode == null ? "" : mode);
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Choose car, bike or walk.");
        }
        TripMember member = access.requireLiveMember(tripId, caller);
        transactions.executeWithoutResult(status -> members.setTravelMode(member.getId(), chosen.name()));
        Position spot = positions.get(tripId, member.getId());
        if (spot != null) {
            refresh(tripId, member.getId(), spot);
        }
    }

    /** After a member's new spot is stored: checks for arrival, then refreshes their ETA if it's worth it. */
    @Async
    public void update(UUID tripId, UUID memberId, Position position) {
        try {
            refresh(tripId, memberId, position);
        } catch (RuntimeException e) {
            // A failed ETA never affects the location update, which has already gone out.
            log.warn("ETA not updated: {}", e.getClass().getSimpleName());
        }
    }

    void refresh(UUID tripId, UUID memberId, Position position) {
        Trip trip = trips.findById(tripId).orElse(null);
        Destination destination = trip == null ? null : trip.getDestination();
        if (destination == null) {
            return;
        }
        TripMember member = members.findById(memberId).orElse(null);
        if (member == null || !member.isActive() || member.getArrivedAt() != null) {
            return;
        }
        Instant now = clock.instant();
        double straight = GeoMath.metres(position.lat(), position.lng(), destination.lat(), destination.lng());
        if (checkArrival(member, straight, now)) {
            return;
        }
        if (!store.takeTurn(tripId, memberId)) {
            return;
        }
        try {
            Eta previous = store.get(tripId, memberId);
            TravelMode mode = EtaRules.modeOf(member.getTravelMode(), previous, straight);
            if (!EtaRules.worthRedoing(previous, position, mode, now)) {
                return;
            }
            Eta eta = work(tripId, memberId, position, destination, straight, mode, previous, now);
            store.put(tripId, eta);
            channel.publish(LiveChannel.etaTopic(tripId), EtaView.of(eta));
        } finally {
            store.endTurn(tripId, memberId);
        }
    }

    /** @return true when the member has now arrived (announced once, to everyone) */
    private boolean checkArrival(TripMember member, double straight, Instant now) {
        UUID tripId = member.getTripId();
        if (straight > ARRIVAL_RADIUS_M) {
            store.wentOutside(tripId, member.getId());
            return false;
        }
        Instant since = store.insideSince(tripId, member.getId(), now);
        if (Duration.between(since, now).compareTo(ARRIVAL_DWELL) < 0) {
            return false;
        }
        Integer updated = transactions.execute(status -> members.markArrived(member.getId(), now));
        if (updated != null && updated == 1) {
            liveTrips.arrived(member);
        }
        return true;
    }

    private Eta work(UUID tripId, UUID memberId, Position position, Destination destination, double straight,
                     TravelMode mode, Eta previous, Instant now) {
        Route route = routeFor(tripId, position, destination, mode);
        double distance;
        double duration;
        String line;
        boolean estimated = route == null;
        if (route != null) {
            distance = route.distanceM();
            duration = route.durationS();
            line = route.polyline();
        } else if (previous != null && previous.mode() == mode) {
            // Scale the last real answer by how much closer they are, keeping its line on the map.
            double before = GeoMath.metres(previous.fromLat(), previous.fromLng(), destination.lat(),
                    destination.lng());
            double ratio = before > 1 ? straight / before : 1;
            distance = previous.distanceM() * ratio;
            duration = previous.durationS() * ratio;
            line = previous.route();
        } else {
            distance = straight * DETOUR;
            duration = distance / mode.typicalSpeed();
            line = null;
        }
        double start = previous == null ? distance : Math.max(previous.startDistanceM(), distance);
        double progress = start <= 0 ? 0 : Math.clamp(1 - distance / start, 0, 1);
        return new Eta(memberId, distance, duration, mode, line, progress, estimated, now, position.lat(),
                position.lng(), start);
    }

    /** A shared recent route, or a fresh one from Mapbox within the trip's budget, or null. */
    private Route routeFor(UUID tripId, Position position, Destination destination, TravelMode mode) {
        String key = EtaStore.routeKey(mode, position.lat(), position.lng(), destination.lat(), destination.lng());
        Route cached = store.cachedRoute(key);
        if (cached != null || !directions.available()) {
            return cached;
        }
        try {
            rateLimiter.check(RateLimit.DIRECTIONS_PER_TRIP, tripId.toString());
        } catch (RateLimitedException overBudget) {
            return null;
        }
        Route fresh = directions.route(position.lat(), position.lng(), destination.lat(), destination.lng(), mode)
                .orElse(null);
        if (fresh != null) {
            store.cacheRoute(key, fresh);
        }
        return fresh;
    }
}
