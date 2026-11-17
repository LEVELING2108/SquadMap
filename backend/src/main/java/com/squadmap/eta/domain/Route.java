package com.squadmap.eta.domain;

/**
 * A route from Mapbox Directions.
 *
 * @param distanceM metres along the road
 * @param durationS seconds, as Mapbox expects for the profile
 * @param polyline  the simplified line, encoded as polyline6
 */
public record Route(double distanceM, double durationS, String polyline) {
}
