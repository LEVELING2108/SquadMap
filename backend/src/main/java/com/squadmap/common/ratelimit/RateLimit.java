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
    /** Each Home chip tap is a paid Mapbox call. */
    NEARBY_PER_USER("nearby-user", 20, Duration.ofMinutes(1)),
    /**
     * Live location: one update per 2 seconds per trip member on average. Two may arrive close together,
     * since network delay can bunch updates the phone sent 2 seconds apart.
     */
    LOCATION_PER_MEMBER("location-member", 2, Duration.ofSeconds(4)),
    /**
     * Mapbox Directions calls for one trip's ETAs, a paid API. Past this, ETAs are scaled from each
     * person's last real route instead of asking Mapbox again.
     */
    DIRECTIONS_PER_TRIP("directions-trip", 300, Duration.ofHours(1)),
    /** Starting to share records consent; no one needs to do that more than a few times. */
    SHARING_PER_MEMBER("sharing-member", 10, Duration.ofHours(1)),
    /** Pausing and resuming location sharing, per trip member. */
    PAUSE_PER_MEMBER("pause-member", 10, Duration.ofMinutes(1)),
    /** Turning push notifications on or off, per account. */
    PUSH_SUBSCRIBE_PER_USER("push-subscribe-user", 10, Duration.ofMinutes(1)),
    /** "Download my data": it reads every table about the account, so a few an hour is plenty. */
    EXPORT_PER_USER("export-user", 5, Duration.ofHours(1)),
    /** Chat messages per trip member. */
    CHAT_PER_MEMBER("chat-member", 20, Duration.ofMinutes(1)),
    /** "Typing" signals per trip member: the app sends one every 2 seconds at most; extra ones are dropped. */
    TYPING_PER_MEMBER("typing-member", 1, Duration.ofSeconds(2)),
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
