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
    TRIP_CREATE_PER_USER("trip-create-user", 20, Duration.ofHours(1));

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
