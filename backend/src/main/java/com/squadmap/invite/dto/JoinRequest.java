package com.squadmap.invite.dto;

import jakarta.validation.constraints.Size;

/**
 * @param displayName   how friends see you on this trip. Required for guests; a signed-in person who leaves
 *                      it out joins under their account name.
 * @param shareLocation the choice on the consent screen: true for "Share my location", false for "Not now"
 */
public record JoinRequest(
        @Size(max = 40, message = "Use 40 characters or fewer.")
        String displayName,

        boolean shareLocation) {
}
