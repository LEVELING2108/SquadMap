package com.squadmap.eta.domain;

/**
 * How a member is getting to the destination, as they chose it (or as guessed until they do). Each maps to
 * a Mapbox Directions profile. A bike means a motorbike or scooter here: it takes the same roads as a car,
 * and Mapbox has no separate profile for it.
 */
public enum TravelMode {
    car("driving-traffic", 8.3),
    bike("driving-traffic", 8.3),
    walk("walking", 1.4);

    private final String profile;
    private final double typicalSpeed;

    TravelMode(String profile, double typicalSpeed) {
        this.profile = profile;
        this.typicalSpeed = typicalSpeed;
    }

    /**
     * The Mapbox Directions profile, as in {@code /directions/v5/mapbox/{profile}/...}. Cars and bikes use
     * the traffic-aware one, so times allow for current traffic.
     */
    public String profile() {
        return profile;
    }

    /** Metres per second, for a rough estimate when no route can be asked for. */
    public double typicalSpeed() {
        return typicalSpeed;
    }
}
