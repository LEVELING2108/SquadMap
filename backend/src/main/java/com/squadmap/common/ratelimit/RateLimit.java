package com.squadmap.common.ratelimit;

import java.time.Duration;

/**
 * Every limit in one place. A limit allows {@code capacity} requests per {@code period}, and
 * refills gradually: a login limit of 5 per minute gives back one attempt every 12 seconds.
 */
public enum RateLimit {

    LOGIN_PER_IP("login-ip", 5, Duration.ofMinutes(1)),
    LOGIN_PER_ACCOUNT("login-account", 5, Duration.ofMinutes(1)),
    SIGNUP_PER_IP("signup-ip", 10, Duration.ofHours(1)),
    REFRESH_PER_IP("refresh-ip", 60, Duration.ofMinutes(1)),
    FORGOT_PER_EMAIL("forgot-email", 3, Duration.ofHours(1)),
    FORGOT_PER_IP("forgot-ip", 10, Duration.ofHours(1)),
    RESET_PER_IP("reset-ip", 10, Duration.ofHours(1)),
    TRIP_CREATE_PER_USER("trip-create-user", 20, Duration.ofHours(1)),
    JOIN_PER_IP("join-ip", 10, Duration.ofMinutes(1)),
    /** Wrong trip codes: after 20 in an hour, the address may not try any code until it refills. */
    JOIN_BAD_CODES_PER_IP("join-bad-codes-ip", 20, Duration.ofHours(1)),
    /** Each search is a paid Mapbox call; the screen also waits for typing to pause before searching. */
    PLACE_SEARCH_PER_USER("place-search-user", 30, Duration.ofMinutes(1)),
    /**
     * Wrong current passwords when changing the password or email: after 5 in 15 minutes the account may
     * not try again until it refills, so a borrowed signed-in device can't be used to guess it.
     */
    PASSWORD_CHECK_PER_ACCOUNT("password-check-account", 5, Duration.ofMinutes(15));

    private final String id;
    private final long capacity;
    private final Duration period;

    RateLimit(String id, long capacity, Duration period) {
        this.id = id;
        this.capacity = capacity;
        this.period = period;
    }

    public String id() {
        return id;
    }

    public long capacity() {
        return capacity;
    }

    public Duration period() {
        return period;
    }
}
