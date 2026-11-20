package com.squadmap.trip.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.security.Caller;
import com.squadmap.location.service.LiveTrips;
import com.squadmap.notify.alert.AlertService;
import com.squadmap.trip.domain.MemberRole;
import com.squadmap.trip.domain.Trip;
import com.squadmap.trip.domain.TripMember;
import com.squadmap.trip.dto.TripResponse;
import com.squadmap.trip.repo.TripMemberRepository;
import com.squadmap.trip.repo.TripRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/** What happens to a trip after it starts: extending, ending, leaving, and running out. */
@Service
public class TripLifecycleService {

    /** Extensions offered on the "ending soon" dialog, in minutes. */
    public static final Set<Integer> EXTEND_MINUTES = Set.of(30, 60, 120);
    /** How long before sharing ends the host is warned. */
    static final int WARN_MINUTES = 10;
    /** No trip shares location for longer than this in total. */
    static final Duration MAX_LENGTH = Duration.ofHours(12);

    private static final Logger log = LoggerFactory.getLogger(TripLifecycleService.class);

    private final TripRepository trips;
    private final TripMemberRepository members;
    private final TripService tripService;
    private final AlertService alerts;
    private final LiveTrips live;
    private final Clock clock;

    public TripLifecycleService(TripRepository trips, TripMemberRepository members, TripService tripService,
                                AlertService alerts, LiveTrips live, Clock clock) {
        this.live = live;
        this.trips = trips;
        this.members = members;
        this.tripService = tripService;
        this.alerts = alerts;
        this.clock = clock;
    }

    /**
     * Adds time to a running trip. Host only.
     *
     * @throws ApiException 409 {@code EXTEND_LIMIT} when the trip would last more than 12 hours in total
     */
    @Transactional
    public TripResponse extend(UUID tripId, UUID userId, int minutes) {
        if (!EXTEND_MINUTES.contains(minutes)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED,
                    "Choose 30 minutes, 1 hour or 2 hours.");
        }
        Trip trip = hostedLiveTrip(tripId, userId, "extend");
        Duration extra = Duration.ofMinutes(minutes);
        if (trip.totalLength().plus(extra).compareTo(MAX_LENGTH) > 0) {
            Duration left = MAX_LENGTH.minus(trip.totalLength());
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.EXTEND_LIMIT,
                    "A trip can share for 12 hours at most. This one can add " + describe(left) + " more.")
                    .with("maxExtraMinutes", left.toMinutes());
        }
        trip.extendBy(extra);
        live.extended(tripId, trip.getExpiresAt());
        return tripService.get(tripId, Caller.user(userId));
    }

    /** Stops the trip for everyone at once and kills its invite link. Host only. */
    @Transactional
    public TripResponse end(UUID tripId, UUID userId) {
        Trip trip = hostedLiveTrip(tripId, userId, "end");
        Instant now = clock.instant();
        trip.end(now);
        trips.flush();
        trips.withdrawConsentForFinishedTrips(now);
        live.ended(tripId, membersOn(tripId));
        // Everyone else with an account hears it; the host ended it, so needs no telling.
        alerts.tripEnded(accountsOn(tripId).stream().filter(id -> !id.equals(trip.getHostId())).toList(),
                tripId, trip.getName());
        log.info("Trip {} ended by its host", tripId);
        return tripService.get(tripId, Caller.user(userId));
    }

    /**
     * Takes the caller off the trip and ends their location sharing. The host can't leave their own
     * trip; they end it instead, so a trip is never left without someone who can end it.
     */
    @Transactional
    public void leave(UUID tripId, Caller caller) {
        if (!caller.mayUseTrip(tripId)) {
            throw TripService.notFound();
        }
        TripMember member = (caller.isGuest()
                ? members.findByIdAndTripIdAndLeftAtIsNull(caller.subject(), tripId)
                : members.findByTripIdAndUserIdAndLeftAtIsNull(tripId, caller.subject()))
                .orElseThrow(TripService::notFound);
        if (member.getRole() == MemberRole.host) {
            throw new ApiException(HttpStatus.CONFLICT, ErrorCode.HOST_CANNOT_LEAVE,
                    "You're the host. End the trip for everyone instead.");
        }
        Instant now = clock.instant();
        member.leave(now);
        trips.withdrawConsentOf(member.getId(), now);
        live.memberLeft(member);
        trips.findById(tripId).ifPresent(trip -> alerts.memberLeft(trip.getHostId(), tripId, trip.getName(),
                member.getDisplayName(), member.getColor()));
    }

    /**
     * Every 30 seconds, records trips whose time has run out and ends their location consent. Safe to run
     * on several instances at once; each step only ever changes rows that still need it.
     */
    @Scheduled(fixedDelay = 30_000, initialDelay = 10_000)
    @Transactional
    public int expireDueTrips() {
        Instant now = clock.instant();
        List<UUID> expired = trips.expireDue(now);
        int withdrawn = trips.withdrawConsentForFinishedTrips(now);
        // Only this run's own trips: the update hands each expired trip to exactly one run.
        for (Trip trip : trips.findAllById(expired)) {
            live.ended(trip.getId(), membersOn(trip.getId()));
            alerts.tripEnded(accountsOn(trip.getId()), trip.getId(), trip.getName());
        }
        if (!expired.isEmpty()) {
            log.info("Expired {} trips; ended {} location consents", expired.size(), withdrawn);
        }
        return expired.size();
    }

    /**
     * Every 30 seconds, warns hosts whose trip stops sharing within {@value #WARN_MINUTES} minutes, so
     * there is time to extend it. Once per end time; again after an extension.
     */
    @Scheduled(fixedDelay = 30_000, initialDelay = 20_000)
    @Transactional
    public int warnEndingSoon() {
        Instant now = clock.instant();
        List<UUID> due = trips.markEndingSoonDue(now, now.plus(Duration.ofMinutes(WARN_MINUTES)));
        for (Trip trip : trips.findAllById(due)) {
            alerts.endingSoon(trip.getHostId(), trip.getId(), trip.getName());
        }
        return due.size();
    }

    /** The accounts on a trip now, host included. Guests have none, so they get no alerts. */
    private List<UUID> accountsOn(UUID tripId) {
        return members.findByTripIdAndLeftAtIsNullOrderByJoinedAt(tripId).stream()
                .map(TripMember::getUserId)
                .filter(Objects::nonNull)
                .toList();
    }

    /** Everyone on the trip now, guests included: whose live data to delete and distance to save at the end. */
    private List<TripMember> membersOn(UUID tripId) {
        return members.findByTripIdAndLeftAtIsNullOrderByJoinedAt(tripId);
    }

    private Trip hostedLiveTrip(UUID tripId, UUID userId, String action) {
        Trip trip = trips.lockById(tripId).orElseThrow(TripService::notFound);
        TripMember member = members.findByTripIdAndUserIdAndLeftAtIsNull(tripId, userId)
                .orElseThrow(TripService::notFound);
        if (member.getRole() != MemberRole.host) {
            throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.NOT_HOST,
                    "Only the host can " + action + " this trip.");
        }
        if (!trip.isLiveAt(clock.instant())) {
            throw new ApiException(HttpStatus.GONE, ErrorCode.TRIP_EXPIRED, "This trip has already ended.");
        }
        return trip;
    }

    private static String describe(Duration duration) {
        long minutes = duration.toMinutes();
        if (minutes <= 0) {
            return "no time";
        }
        return minutes % 60 == 0 ? (minutes / 60) + (minutes == 60 ? " hour" : " hours") : minutes + " minutes";
    }
}
