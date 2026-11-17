package com.squadmap.location.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.security.Caller;
import com.squadmap.trip.domain.Trip;
import com.squadmap.trip.domain.TripMember;
import com.squadmap.trip.repo.TripMemberRepository;
import com.squadmap.trip.repo.TripRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.UUID;

/**
 * Who may see and send live locations on a trip: its current members, while the trip is running.
 * Checked on every subscription and every update, so leaving or the trip ending takes effect at once.
 */
@Service
public class TripAccess {

    private final TripRepository trips;
    private final TripMemberRepository members;
    private final Clock clock;

    public TripAccess(TripRepository trips, TripMemberRepository members, Clock clock) {
        this.trips = trips;
        this.members = members;
        this.clock = clock;
    }

    /**
     * The caller's membership of a running trip.
     *
     * @throws ApiException 404 {@code TRIP_NOT_FOUND} when the trip doesn't exist or the caller isn't on it
     *                      (the same answer, so nobody learns about other trips); 410 {@code TRIP_EXPIRED}
     *                      when the trip is over
     */
    @Transactional(readOnly = true)
    public TripMember requireLiveMember(UUID tripId, Caller caller) {
        TripMember member = requireMember(tripId, caller);
        Trip trip = trips.findById(tripId).orElseThrow(TripAccess::notFound);
        if (!trip.isLiveAt(clock.instant())) {
            throw new ApiException(HttpStatus.GONE, ErrorCode.TRIP_EXPIRED, "This trip has ended.");
        }
        return member;
    }

    /** The caller's membership of the trip, whether or not it is still running. */
    @Transactional(readOnly = true)
    public TripMember requireMember(UUID tripId, Caller caller) {
        if (!caller.mayUseTrip(tripId)) {
            throw notFound();
        }
        return (caller.isGuest()
                ? members.findByIdAndTripIdAndLeftAtIsNull(caller.subject(), tripId)
                : members.findByTripIdAndUserIdAndLeftAtIsNull(tripId, caller.subject()))
                .orElseThrow(TripAccess::notFound);
    }

    static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, ErrorCode.TRIP_NOT_FOUND, "This trip doesn't exist.");
    }
}
