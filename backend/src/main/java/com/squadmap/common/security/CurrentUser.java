package com.squadmap.common.security;

import org.springframework.security.oauth2.jwt.Jwt;

import java.util.UUID;

/** Reads the signed-in account from a verified access token. */
public final class CurrentUser {

    private CurrentUser() {
    }

    public static UUID id(Jwt token) {
        return UUID.fromString(token.getSubject());
    }
}
