package com.squadmap.place;

import com.squadmap.common.error.ApiException;
import com.squadmap.place.domain.GeoPoint;
import com.squadmap.place.domain.Place;
import com.squadmap.place.service.MapboxGeocoder;
import com.squadmap.place.service.PlaceService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class PlaceServiceTest {

    private static final GeoPoint PICKED = new GeoPoint(18.5622, 73.9167);

    private final MapboxGeocoder geocoder = mock(MapboxGeocoder.class);
    private final PlaceService places = new PlaceService(geocoder);

    private void mapboxReturns(Place... results) {
        when(geocoder.search(anyString(), any(), anyInt(), eq(true))).thenReturn(List.of(results));
    }

    private static Place place(String name, double lat, double lng) {
        return new Place(name, name, null, new GeoPoint(lat, lng), "poi");
    }

    @Test
    void theSameNameMatchesDespiteCaseAndSpacing() {
        mapboxReturns(place("Pune", 18.5625, 73.9170), place("phoenix   MARKETCITY", 18.5640, 73.9170));

        assertThat(places.confirm("Phoenix Marketcity", PICKED).name()).isEqualTo("phoenix   MARKETCITY");
    }

    @Test
    void theSameNameTooFarAwayIsAnotherBranch() {
        mapboxReturns(place("Phoenix Marketcity", 19.0866, 72.8890));

        assertThatThrownBy(() -> places.confirm("Phoenix Marketcity", PICKED)).isInstanceOf(ApiException.class);
    }

    @Test
    void searchTextIsTidiedAndTooShortTextAsksNothing() {
        assertThat(places.search(" p\u0007 ", null)).isEmpty();
    }
}
