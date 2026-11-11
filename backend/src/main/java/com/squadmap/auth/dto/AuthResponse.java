package com.squadmap.auth.dto;

import com.squadmap.user.dto.UserResponse;

/**
 * @param accessToken bearer token for API calls; the web app keeps it in memory only
 * @param expiresIn   seconds until the access token expires
 */
public record AuthResponse(String accessToken, long expiresIn, UserResponse user) {

    /** Keeps the token out of logs if the response is ever printed. */
    @Override
    public String toString() {
        return "AuthResponse[accessToken=***]";
    }
}
