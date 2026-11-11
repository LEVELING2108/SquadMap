package com.squadmap.invite.dto;

import com.squadmap.trip.domain.Destination;

import java.time.Instant;

/**
 * What someone holding an invite link sees before joining: enough to recognise the trip,
 * nothing about where anyone is.
 *
 * @param memberCount people already on the trip, the host included
 */
public record JoinPreviewResponse(
        String code,
        String tripName,
        String hostName,
        Destination destination,
        long memberCount,
        Instant expiresAt) {
}
