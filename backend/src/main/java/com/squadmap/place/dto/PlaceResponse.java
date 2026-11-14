package com.squadmap.place.dto;

import com.squadmap.place.domain.GeoPoint;
import com.squadmap.place.domain.Place;

/**
 * @param address        the rest of the address, for a second line under the name
 * @param kind           what it is (poi, address, street, place...), for choosing an icon
 * @param distanceMeters from the point the search was near; null when no point was given
 */
public record PlaceResponse(String id, String name, String address, double lat, double lng, String kind,
                            Long distanceMeters) {

    public static PlaceResponse of(Place place, GeoPoint near) {
        Long distance = near == null ? null : Math.round(near.metersTo(place.point()));
        return new PlaceResponse(place.id(), place.name(), place.address(), place.point().lat(), place.point().lng(),
                place.kind(), distance);
    }
}
