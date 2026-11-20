package com.squadmap.trip.dto;

import com.squadmap.trip.domain.Destination;
import com.squadmap.trip.domain.MemberRole;
import com.squadmap.trip.domain.TripStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * A trip in numbers, as the caller saw it. Nothing about where anyone went: only totals.
 *
 * @param endedAt         when sharing stopped (ended by the host or ran out); null while the trip runs
 * @param durationSeconds from the start until it ended, or until now while it runs
 * @param friendCount     everyone else who was on the trip at any point
 * @param distanceM       how far the caller moved while sharing, in metres; null if they never shared
 * @param arrivedAt       when the caller reached the destination; null if they didn't (or there was none)
 */
public record TripSummaryResponse(
        UUID id,
        String name,
        Destination destination,
        TripStatus status,
        MemberRole role,
        Instant startsAt,
        Instant endedAt,
        long durationSeconds,
        int friendCount,
        Integer distanceM,
        Instant arrivedAt) {
}
