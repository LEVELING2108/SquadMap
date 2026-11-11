package com.squadmap.trip.dto;

import com.squadmap.trip.domain.Destination;
import com.squadmap.trip.domain.MemberRole;
import com.squadmap.trip.domain.TripStatus;

import java.time.Instant;
import java.util.UUID;

/**
 * A trip as one of its members sees it.
 *
 * @param role        the caller's role on this trip
 * @param memberCount people currently on the trip, the host included
 */
public record TripResponse(
        UUID id,
        String name,
        String code,
        String inviteUrl,
        Destination destination,
        boolean chatEnabled,
        Instant startsAt,
        Instant expiresAt,
        TripStatus status,
        MemberRole role,
        long memberCount) {
}
