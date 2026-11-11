package com.squadmap.invite.dto;

import com.squadmap.trip.domain.MemberRole;

import java.util.UUID;

/**
 * The result of joining.
 *
 * @param accessToken a guest's pass for this one trip, valid until the trip is due to end. {@code null} for a
 *                    signed-in person, who keeps using their own session. Kept in memory only.
 * @param expiresIn   seconds until the guest pass expires; {@code null} for a signed-in person
 */
public record JoinResponse(
        UUID tripId,
        UUID memberId,
        String displayName,
        String color,
        MemberRole role,
        boolean sharingLocation,
        String accessToken,
        Long expiresIn) {

    /** Keeps the guest pass out of logs if the response is ever printed. */
    @Override
    public String toString() {
        return "JoinResponse[tripId=" + tripId + ", accessToken=" + (accessToken == null ? "none" : "***") + "]";
    }
}
