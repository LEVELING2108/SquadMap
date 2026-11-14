package com.squadmap.place;

import com.squadmap.FakeMapbox;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.place.config.MapboxProperties;
import com.squadmap.place.domain.GeoPoint;
import com.squadmap.place.domain.Place;
import com.squadmap.place.service.MapboxGeocoder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.util.List;

import static com.squadmap.FakeMapbox.feature;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class MapboxGeocoderTest {

    private final FakeMapbox mapbox = FakeMapbox.get();

    @BeforeEach
    void reset() {
        mapbox.reset();
    }

    private MapboxGeocoder geocoder(String token, String country) {
        return new MapboxGeocoder(new MapboxProperties(mapbox.baseUrl(), token, Duration.ofSeconds(1), country),
                RestClient.builder());
    }

    @Test
    void withoutATokenSearchIsUnavailableAndMapboxIsNotCalled() {
        assertThatThrownBy(() -> geocoder(" ", "in").search("pune", null, 6, false))
                .isInstanceOf(ApiException.class)
                .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.PLACES_UNAVAILABLE);
        assertThat(mapbox.requests()).isEmpty();
    }

    @Test
    void searchTextCannotAddOrChangeParameters() {
        geocoder("t", "in").search("a&permanent=true&access_token=x#frag", null, 6, false);

        var sent = mapbox.requests().get(0);
        assertThat(sent.get("q")).isEqualTo("a&permanent=true&access_token=x#frag");
        assertThat(sent.get("permanent")).isEqualTo("false");
        assertThat(sent.get("access_token")).isEqualTo("t");
    }

    @Test
    void anEmptyCountryMeansAnywhere() {
        geocoder("t", "").search("paris", new GeoPoint(48.85, 2.35), 6, false);

        assertThat(mapbox.requests().get(0)).doesNotContainKey("country").containsEntry("proximity", "2.35,48.85");
    }

    @Test
    void resultsWithoutANameOrCoordinatesAreSkipped() {
        mapbox.answer(200, """
                {"features":[
                  {"properties":{"name":"","coordinates":{"latitude":1,"longitude":2}}},
                  {"properties":{"name":"No point"}},
                  %s
                ]}""".formatted(feature("ok", "Pune", "Maharashtra, India", "place", 18.52, 73.85)));

        List<Place> places = geocoder("t", "in").search("pune", null, 6, false);

        assertThat(places).extracting(Place::name).containsExactly("Pune");
        assertThat(places.get(0).address()).isEqualTo("Maharashtra, India");
    }

    @Test
    void anUnreadableAnswerIsUnavailable() {
        mapbox.answer(200, "not json");

        assertThatThrownBy(() -> geocoder("t", "in").search("pune", null, 6, false))
                .extracting(e -> ((ApiException) e).getCode()).isEqualTo(ErrorCode.PLACES_UNAVAILABLE);
    }

    @Test
    void coarseRoundsToAboutAKilometre() {
        assertThat(new GeoPoint(18.56789, 73.91432).coarse()).isEqualTo(new GeoPoint(18.57, 73.91));
        assertThat(new GeoPoint(-33.86785, 151.20732).coarse()).isEqualTo(new GeoPoint(-33.87, 151.21));
    }

    @Test
    void distanceIsMeasuredOnTheEarth() {
        // Pune railway station to Phoenix Marketcity, Viman Nagar: about 5.8 km in a straight line.
        double meters = new GeoPoint(18.5289, 73.8744).metersTo(new GeoPoint(18.5622, 73.9167));
        assertThat(meters).isBetween(5_500.0, 6_000.0);
    }
}
