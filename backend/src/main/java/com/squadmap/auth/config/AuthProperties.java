package com.squadmap.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * @param jwtSecret           key that signs access tokens, at least 32 bytes. When empty outside
 *                            production, a temporary key is generated at startup.
 * @param issuer              value of the {@code iss} claim
 * @param accessTokenTtl      how long an access token is valid
 * @param refreshTokenTtl     how long a session lasts without being used; each refresh restarts it
 * @param refreshCookieSecure send the refresh cookie over HTTPS only. Turned off only for local
 *                            development over plain HTTP.
 * @param termsVersion        version of the Terms and Privacy Policy a new account agrees to
 */
@ConfigurationProperties("squadmap.auth")
public record AuthProperties(
        @DefaultValue("") String jwtSecret,
        @DefaultValue("squadmap") String issuer,
        @DefaultValue("15m") Duration accessTokenTtl,
        @DefaultValue("30d") Duration refreshTokenTtl,
        @DefaultValue("true") boolean refreshCookieSecure,
        @DefaultValue("2026-11") String termsVersion) {
}
