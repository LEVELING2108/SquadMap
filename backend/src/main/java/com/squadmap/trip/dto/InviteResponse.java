package com.squadmap.trip.dto;

import com.squadmap.trip.domain.Destination;

import java.time.Instant;

/** What the invite screen shows: the boarding pass, the link and its code. */
public record InviteResponse(
        String code,
        String url,
        String tripName,
        String hostName,
        Destination destination,
        Instant expiresAt) {
}
