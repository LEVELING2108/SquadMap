package com.squadmap.trip.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.security.Caller;
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
import java.util.Set;
import java.util.UUID;

/** What happens to a trip after it starts: extending, ending, leaving, and running out. */
@Service
public class TripLifecycleService {

    /** Extensions offered on the "ending soon" dialog, in minutes. */
    public static final Set<Integer> EXTEND_MINUTES = Set.of(30, 60, 120);
    /** No trip shares location for longer than this in total. */
    static final Duration MAX_LENGTH = Duration.ofHours(12);

    private static final Logger log = LoggerFactory.getLogger(TripLifecycleService.class);

    private final TripRepository trips;
    private final TripMemberRepository members;
    private final TripService tripService;
    private final Clock clock;

    public TripLifecycleService(TripRepository trips, TripMemberRepository members, TripService tripService,
                                Clock clock) {
        this.trips = trips;
        this.members = members;
        this.tripService = tripService;
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
    }

    /**
     * Every 30 seconds, records trips whose time has run out and ends their location consent. Safe to run
     * on several instances at once; each step only ever changes rows that still need it.
     */
    @Scheduled(fixedDelay = 30_000, initialDelay = 10_000)
    @Transactional
    public int expireDueTrips() {
        Instant now = clock.instant();
        int expired = trips.expireDue(now);
        int withdrawn = trips.withdrawConsentForFinishedTrips(now);
        if (expired > 0) {
            log.info("Expired {} trips; ended {} location consents", expired, withdrawn);
        }
        return expired;
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
