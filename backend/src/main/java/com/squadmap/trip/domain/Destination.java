package com.squadmap.trip.domain;

/** Where the trip is heading. Coordinates are WGS84 degrees. */
public record Destination(String name, double lat, double lng) {
}
