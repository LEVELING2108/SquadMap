package com.squadmap.place.domain;

/** A point on Earth in WGS84 degrees. */
public record GeoPoint(double lat, double lng) {

    private static final double EARTH_RADIUS_METERS = 6_371_000;

    /**
     * The same point to about a kilometre (two decimal places), so where someone is never leaves the
     * server more precisely than search needs.
     */
    public GeoPoint coarse() {
        return new GeoPoint(Math.round(lat * 100) / 100.0, Math.round(lng * 100) / 100.0);
    }

    /** Great-circle distance in metres. */
    public double metersTo(GeoPoint other) {
        double dLat = Math.toRadians(other.lat - lat);
        double dLng = Math.toRadians(other.lng - lng);
        double a = Math.pow(Math.sin(dLat / 2), 2)
                + Math.cos(Math.toRadians(lat)) * Math.cos(Math.toRadians(other.lat)) * Math.pow(Math.sin(dLng / 2), 2);
        return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(a));
    }
}
