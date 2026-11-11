package com.squadmap.auth.web;

import com.squadmap.auth.config.AuthProperties;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/**
 * The cookie that carries the refresh token. Scripts cannot read it (HttpOnly), browsers send it
 * only over HTTPS (Secure), only with same-site requests (SameSite=Lax), and only to the auth
 * routes (Path), so it never travels with ordinary API calls.
 */
@Component
public class RefreshCookie {

    public static final String NAME = "sm_refresh";
    private static final String PATH = "/api/v1/auth";

    private final AuthProperties properties;

    public RefreshCookie(AuthProperties properties) {
        this.properties = properties;
    }

    public String set(String token) {
        return build(token, properties.refreshTokenTtl());
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
