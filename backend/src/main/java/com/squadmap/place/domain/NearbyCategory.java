package com.squadmap.place.domain;

/** The kinds of place the Home chips look for, and Mapbox's category for each. */
public enum NearbyCategory {
    cafes("cafe"),
    stays("hotel"),
    sights("tourist_attraction");

    private final String mapboxId;

    NearbyCategory(String mapboxId) {
        this.mapboxId = mapboxId;
    }

    public String mapboxId() {
        return mapboxId;
    }
}
