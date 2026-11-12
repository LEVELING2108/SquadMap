package com.squadmap.invite.web;

import com.squadmap.auth.config.AuthProperties;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * Keeps a guest on their trip across reloads. It carries the guest's pass, but scripts can't read it
 * (HttpOnly), browsers send it only over HTTPS (Secure, outside local development), only with
 * same-site requests (SameSite=Lax), and only to the guest session routes (Path). It expires with the
 * pass, at the trip's end.
 */
@Component
public class GuestCookie {

    public static final String NAME = "sm_guest";
    private static final String PATH = "/api/v1/guest";

    private final AuthProperties properties;

    public GuestCookie(AuthProperties properties) {
        this.properties = properties;
    }

    public String set(String pass, long expiresInSeconds) {
        return build(pass, Duration.ofSeconds(Math.max(0, expiresInSeconds)));
    }

    public String clear() {
        return build("", Duration.ZERO);
    }

    private String build(String value, Duration maxAge) {
        return ResponseCookie.from(NAME, value)
                .httpOnly(true)
                .secure(properties.refreshCookieSecure())
                .sameSite("Lax")
                .path(PATH)
                .maxAge(maxAge)
                .build()
                .toString();
    }
}
