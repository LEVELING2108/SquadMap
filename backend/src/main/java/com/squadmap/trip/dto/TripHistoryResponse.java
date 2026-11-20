package com.squadmap.trip.dto;

import com.squadmap.trip.domain.Destination;
import com.squadmap.trip.domain.MemberRole;
import com.squadmap.trip.domain.TripStatus;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * One page of the trips an account has been on, newest first.
 *
 * @param nextBefore pass as {@code before} to get the next, older page; null when there are no more
 */
public record TripHistoryResponse(List<Item> items, UUID nextBefore) {

    /**
     * @param expiresAt   when sharing is set to stop (or stopped, for a trip that ran out)
     * @param endedAt     when sharing stopped: ended by the host, or ran out. Null while the trip runs
     * @param role        the caller's role on the trip
     * @param friendCount everyone else who was on the trip at any point
     * @param friends     up to 5 of their names, in the order they joined
     * @param distanceM   how far the caller moved while sharing, in metres, saved when the trip ended or
     *                    they left; null while it runs or if they never shared
     */
    public record Item(
            UUID id,
            String name,
            Destination destination,
            Instant startsAt,
            Instant expiresAt,
            Instant endedAt,
            TripStatus status,
            MemberRole role,
            int friendCount,
            List<String> friends,
            Integer distanceM) {
    }
}
