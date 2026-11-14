package com.squadmap.place.domain;

/**
 * One search result.
 *
 * @param id      Mapbox's id for it, only good for telling results apart on screen
 * @param kind    what it is: poi, address, street, neighborhood, locality, place, region...
 */
public record Place(String id, String name, String address, GeoPoint point, String kind) {
}
