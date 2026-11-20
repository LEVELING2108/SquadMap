package com.squadmap.trip.service;

import com.squadmap.common.security.Caller;
import com.squadmap.location.service.DistanceStore;
import com.squadmap.trip.domain.MemberRole;
import com.squadmap.trip.domain.Trip;
import com.squadmap.trip.domain.TripMember;
import com.squadmap.trip.domain.TripStatus;
import com.squadmap.trip.dto.TripSummaryResponse;
import com.squadmap.trip.repo.TripMemberRepository;
import com.squadmap.trip.repo.TripRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Trip summaries: the numbers on "You made it!", Trip complete and the history cards. */
@Service
public class TripSummaryService {

    private final TripRepository trips;
    private final TripMemberRepository members;
    private final DistanceStore distances;
    private final Clock clock;

    public TripSummaryService(TripRepository trips, TripMemberRepository members, DistanceStore distances,
                              Clock clock) {
        this.trips = trips;
        this.members = members;
        this.distances = distances;
        this.clock = clock;
    }

    /**
     * The caller's summary of a trip they are or were on, also after they left or it ended. A guest's pass
     * only ever reads its own trip.
     *
     * @throws com.squadmap.common.error.ApiException 404 {@code TRIP_NOT_FOUND} when the trip doesn't exist or
     *                                                the caller was never on it (the same answer for both)
     */
    @Transactional(readOnly = true)
    public TripSummaryResponse summary(UUID tripId, Caller caller) {
        if (!caller.mayUseTrip(tripId)) {
            throw TripService.notFound();
        }
        Trip trip = trips.findById(tripId).orElseThrow(TripService::notFound);
        List<TripMember> everyone = members.findByTripIdInOrderByJoinedAt(List.of(tripId));
        List<TripMember> mine = everyone.stream().filter(member -> isCaller(member, caller)).toList();
        if (mine.isEmpty()) {
            throw TripService.notFound();
        }
        int friends = (int) everyone.stream().filter(member -> !isCaller(member, caller)).count();

        Instant now = clock.instant();
        TripStatus status = trip.statusAt(now);
        Instant endedAt = status == TripStatus.active ? null
                : trip.getEndedAt() != null ? trip.getEndedAt() : trip.getExpiresAt();
        long seconds = Math.max(0, Duration.between(trip.getStartsAt(), endedAt != null ? endedAt : now).toSeconds());

        Integer distance = null;
        for (TripMember member : mine) {
            // While the trip runs, a member still on it has a running total rather than a saved one.
            Integer moved = status == TripStatus.active && member.isActive()
                    ? distances.total(tripId, member.getId())
                    : member.getDistanceM();
            if (moved != null) {
                distance = (distance == null ? 0 : distance) + moved;
            }
        }
        Instant arrivedAt = mine.stream().map(TripMember::getArrivedAt).filter(Objects::nonNull)
                .max(Instant::compareTo).orElse(null);
        MemberRole role = mine.stream().anyMatch(member -> member.getRole() == MemberRole.host)
                ? MemberRole.host : MemberRole.member;
        return new TripSummaryResponse(trip.getId(), trip.getName(), trip.getDestination(), status, role,
                trip.getStartsAt(), endedAt, seconds, friends, distance, arrivedAt);
    }

    /** Someone who left and joined again has several rows; all of them are theirs. */
    private static boolean isCaller(TripMember member, Caller caller) {
        return caller.isGuest() ? member.getId().equals(caller.subject()) : caller.subject().equals(member.getUserId());
    }
}
