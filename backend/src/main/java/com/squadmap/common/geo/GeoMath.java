package com.squadmap.common.geo;

/** Distances on the Earth's surface, good to a few metres at the scales a trip covers. */
public final class GeoMath {

    private static final double EARTH_RADIUS_M = 6_371_000;

    private GeoMath() {
    }

    /** Great-circle distance in metres. */
    public static double metres(double lat1, double lng1, double lat2, double lng2) {
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(Math.toRadians(lat1))
                * Math.cos(Math.toRadians(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
    }

    /** About 220 m: the size of the area a rough location falls in. */
    public static final double AREA_STEP_DEG = 0.002;

    /**
     * The centre of the roughly 220 m square a point falls in, for sharing an area instead of a spot. The
     * web app snaps the same way before sending, and the server snaps again, so an exact spot never spreads.
     *
     * @return {lat, lng}
     */
    public static double[] area(double lat, double lng) {
        double snappedLat = Math.round(lat / AREA_STEP_DEG) * AREA_STEP_DEG;
        // Lines of longitude draw together towards the poles, so the step widens to keep the square square.
        double lngStep = AREA_STEP_DEG / Math.max(0.2, Math.cos(Math.toRadians(snappedLat)));
        double snappedLng = Math.round(lng / lngStep) * lngStep;
        return new double[] {round6(snappedLat), round6(Math.max(-180, Math.min(180, snappedLng)))};
    }

    private static double round6(double value) {
        return Math.round(value * 1e6) / 1e6;
    }
}
