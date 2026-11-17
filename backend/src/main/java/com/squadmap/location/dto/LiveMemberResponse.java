package com.squadmap.location.dto;

import com.squadmap.location.domain.Position;
import com.squadmap.trip.domain.MemberRole;

import java.time.Instant;
import java.util.UUID;

/**
 * One person on the trip, for the live map's first load and after a reconnect.
 *
 * @param you       true for the caller's own row
 * @param sharing   whether this person agreed to share their location on this trip
 * @param location  their last spot from the past few minutes, or null when there is none
 * @param arrivedAt when they reached the destination, or null
 */
public record LiveMemberResponse(UUID memberId, String displayName, String color, MemberRole role, boolean you,
                                 boolean sharing, Position location, Instant arrivedAt) {
}
