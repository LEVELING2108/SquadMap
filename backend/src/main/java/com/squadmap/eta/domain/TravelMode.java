package com.squadmap.eta.domain;

/** How a member is getting there, judged from their speed. Each matches a Mapbox Directions profile. */
public enum TravelMode {
    driving("driving", 8.3),
    walking("walking", 1.4);

    private final String profile;
    private final double typicalSpeed;

    TravelMode(String profile, double typicalSpeed) {
        this.profile = profile;
        this.typicalSpeed = typicalSpeed;
    }

    /** The Mapbox Directions profile, as in {@code /directions/v5/mapbox/{profile}/...}. */
    public String profile() {
        return profile;
    }

    /** Metres per second, for a rough estimate when no route can be asked for. */
    public double typicalSpeed() {
        return typicalSpeed;
    }
}
