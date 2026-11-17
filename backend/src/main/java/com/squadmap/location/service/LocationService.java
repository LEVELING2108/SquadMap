package com.squadmap.location.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.geo.GeoMath;
import com.squadmap.common.id.UuidV7;
import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.common.security.Caller;
import com.squadmap.eta.service.EtaService;
import com.squadmap.invite.config.InviteProperties;
import com.squadmap.invite.domain.LocationConsent;
import com.squadmap.invite.repo.LocationConsentRepository;
import com.squadmap.location.domain.Position;
import com.squadmap.location.dto.LiveMemberResponse;
import com.squadmap.location.dto.LocationUpdate;
import com.squadmap.location.dto.MemberLocation;
import com.squadmap.trip.domain.TripMember;
import com.squadmap.trip.repo.TripMemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Takes in members' live locations, checks them, keeps the latest one per member for a few minutes, and
 * passes it to the rest of the trip. Coordinates are never logged.
 */
@Service
public class LocationService {

    /** Readings vaguer than this (a city-wide guess) would put a dot in the wrong street. */
    static final double MAX_ACCURACY_M = 200;
    /** About 250 km/h: faster than any road trip, slower than a phone's location jumping across town. */
    static final double MAX_SPEED_MPS = 70;
    /** A reading queued while offline is still worth showing for this long. */
    static final Duration MAX_AGE = Duration.ofMinutes(5);
    /** Phone clocks drift; a reading this far in the future is wrong. */
    static final Duration MAX_CLOCK_AHEAD = Duration.ofSeconds(30);

    private final TripAccess access;
    private final TripMemberRepository members;
    private final LocationConsentRepository consents;
    private final PositionStore positions;
    private final LiveChannel channel;
    private final LiveTrips liveTrips;
    private final RateLimiter rateLimiter;
    private final InviteProperties inviteProperties;
    private final EtaService etas;
    private final Clock clock;

    public LocationService(TripAccess access, TripMemberRepository members, LocationConsentRepository consents,
                           PositionStore positions, LiveChannel channel, LiveTrips liveTrips,
                           RateLimiter rateLimiter, InviteProperties inviteProperties, EtaService etas,
                           Clock clock) {
        this.etas = etas;
        this.access = access;
        this.members = members;
        this.consents = consents;
        this.positions = positions;
        this.channel = channel;
        this.liveTrips = liveTrips;
        this.rateLimiter = rateLimiter;
        this.inviteProperties = inviteProperties;
        this.clock = clock;
    }

    /**
     * Records the caller's new spot and sends it to everyone on the trip. A reading older than the one
     * already kept (a late or repeated message) is ignored without an error.
     *
     * @throws ApiException 403 {@code NOT_SHARING} when the caller hasn't agreed to share on this trip;
     *                      422 {@code LOCATION_REJECTED} for a reading that can't be right;
     *                      429 {@code RATE_LIMITED} for more than one reading per 2 seconds
     */
    @Transactional(readOnly = true)
    public void publish(UUID tripId, Caller caller, LocationUpdate update) {
        TripMember member = access.requireLiveMember(tripId, caller);
        if (!consents.existsByTripMemberIdAndWithdrawnAtIsNull(member.getId())) {
            throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.NOT_SHARING,
                    "Turn on location sharing for this trip first.");
        }
        Position position = check(update);
        rateLimiter.check(RateLimit.LOCATION_PER_MEMBER, member.getId().toString());

        Position previous = positions.get(tripId, member.getId());
        if (previous != null) {
            if (!position.ts().isAfter(previous.ts())) {
                return;
            }
            if (impossibleJump(previous, position)) {
                throw rejected("That location is too far from the last one to be right.");
            }
        }
        positions.put(tripId, member.getId(), position);
        channel.publish(LiveChannel.locationsTopic(tripId), MemberLocation.of(member.getId(), position));
        // In the background: the ETA and the arrival check never hold up the update itself.
        etas.update(tripId, member.getId(), position);
    }

    /** Everyone on the trip, with the spots that are still fresh, for the map's first load. */
    @Transactional(readOnly = true)
    public List<LiveMemberResponse> snapshot(UUID tripId, Caller caller) {
        TripMember me = access.requireMember(tripId, caller);
        List<TripMember> everyone = members.findByTripIdAndLeftAtIsNullOrderByJoinedAt(tripId);
        List<UUID> ids = everyone.stream().map(TripMember::getId).toList();
        Set<UUID> sharing = consents.findSharing(ids);
        Map<UUID, Position> spots = positions.getAll(tripId, sharing);
        return everyone.stream()
                .map(member -> new LiveMemberResponse(member.getId(), member.getDisplayName(), member.getColor(),
                        member.getRole(), member.getId().equals(me.getId()), sharing.contains(member.getId()),
                        spots.get(member.getId()), member.getArrivedAt(), member.getTravelMode()))
                .toList();
    }

    /**
     * Records the caller's agreement to share their location on this trip, for people who chose "Not now"
     * when joining and for the host. Doing it again changes nothing.
     */
    @Transactional
    public void startSharing(UUID tripId, Caller caller) {
        TripMember member = access.requireLiveMember(tripId, caller);
        if (consents.existsByTripMemberIdAndWithdrawnAtIsNull(member.getId())) {
            return;
        }
        rateLimiter.check(RateLimit.SHARING_PER_MEMBER, member.getId().toString());
        consents.save(new LocationConsent(UuidV7.generate(clock), member.getId(),
                inviteProperties.locationPolicyVersion(), clock.instant()));
        liveTrips.sharingStarted(member);
    }

    private Position check(LocationUpdate update) {
        if (update == null || update.lat() == null || update.lng() == null || update.acc() == null
                || update.ts() == null) {
            throw invalid("A location needs lat, lng, acc and ts.");
        }
        double lat = update.lat();
        double lng = update.lng();
        if (!Double.isFinite(lat) || !Double.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            throw invalid("That isn't a place on Earth.");
        }
        if (!Double.isFinite(update.acc()) || update.acc() < 0) {
            throw invalid("Accuracy must be zero or more metres.");
        }
        if (update.acc() > MAX_ACCURACY_M) {
            throw rejected("That location is too rough to show.");
        }
        Double speed = update.speed();
        if (speed != null && (!Double.isFinite(speed) || speed < 0 || speed > MAX_SPEED_MPS)) {
            speed = null;
        }
        Double heading = update.heading();
        if (heading != null && (!Double.isFinite(heading) || heading < 0 || heading >= 360)) {
            heading = null;
        }
        Instant now = clock.instant();
        if (update.ts().isAfter(now.plus(MAX_CLOCK_AHEAD))) {
            throw rejected("That location's time is in the future. Check your phone's clock.");
        }
        if (update.ts().isBefore(now.minus(MAX_AGE))) {
            throw rejected("That location is too old to show.");
        }
        // About 10 cm: finer than any phone can tell, and no more than the map needs.
        return new Position(round(lat, 6), round(lng, 6), round(update.acc(), 1),
                speed == null ? null : round(speed, 1), heading == null ? null : round(heading, 0), update.ts());
    }

    /**
     * Faster than {@link #MAX_SPEED_MPS} from the last spot, once both spots' accuracy is allowed for.
     * A wrong first spot sorts itself out: as time passes, the speed needed to get here drops.
     */
    static boolean impossibleJump(Position from, Position to) {
        double seconds = Math.max(1, Duration.between(from.ts(), to.ts()).toMillis() / 1000.0);
        double metres = Math.max(0, GeoMath.metres(from.lat(), from.lng(), to.lat(), to.lng()) - from.acc()
                - to.acc());
        return metres / seconds > MAX_SPEED_MPS;
    }

    private static double round(double value, int places) {
        double scale = Math.pow(10, places);
        return Math.round(value * scale) / scale;
    }

    private static ApiException invalid(String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, message);
    }

    private static ApiException rejected(String message) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.LOCATION_REJECTED, message);
    }
}
