package com.squadmap.place;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.FakeMapbox;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class NearbyIT extends IntegrationTest {

    private static final String NEARBY = "/api/v1/places/nearby";

    private final FakeMapbox mapbox = FakeMapbox.get();
    private String priya;

    @BeforeEach
    void signUp() {
        priya = post("/api/v1/auth/signup", Map.of("name", "Priya", "email", "priya@example.com",
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
    }

    /** A Search Box category result, with the fields the app reads. */
    private static String poi(String id, String name, String address, double lat, double lng) {
        return """
                {"type":"Feature","properties":{"mapbox_id":"%s","name":"%s","full_address":"%s",
                 "feature_type":"poi","coordinates":{"latitude":%s,"longitude":%s}}}
                """.formatted(id, name, address, lat, lng);
    }

    @Test
    void nearbyCafesComeBackNearestFirstWithDistances() {
        mapbox.answerWith(
                poi("c2", "Cafe Far", "Koregaon Park, Pune", 18.5400, 73.8930),
                poi("c1", "Cafe Chopped Leaf", "Rose Garden Society, Pune", 18.5684, 73.9145));

        ResponseEntity<JsonNode> response = get(NEARBY + "?category=cafes&near=18.5679,73.9143", priya);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode first = response.getBody().get(0);
        assertThat(first.get("name").asText()).isEqualTo("Cafe Chopped Leaf");
        assertThat(first.get("address").asText()).isEqualTo("Rose Garden Society, Pune");
        assertThat(first.get("kind").asText()).isEqualTo("cafes");
        assertThat(first.get("distanceMeters").asLong()).isBetween(40L, 80L);
        assertThat(response.getBody().get(1).get("name").asText()).isEqualTo("Cafe Far");
    }

    @ParameterizedTest
    @CsvSource({"cafes, cafe", "stays, hotel", "sights, tourist_attraction"})
    void eachChipAsksMapboxForItsCategoryAroundARoundedPoint(String category, String mapboxCategory) {
        get(NEARBY + "?category=" + category + "&near=18.56789,73.91432", priya);

        Map<String, String> sent = mapbox.requests().get(0);
        assertThat(sent.get("_path")).isEqualTo("/search/searchbox/v1/category/" + mapboxCategory);
        // Longitude first, rounded to three decimals (about 100 m).
        assertThat(sent.get("proximity")).isEqualTo("73.914,18.568");
        assertThat(sent.get("limit")).isEqualTo("10");
        assertThat(sent.get("access_token")).isEqualTo(FakeMapbox.TOKEN);
    }

    @Test
    void anUnknownCategoryOrPointIsRefusedWithoutAskingMapbox() {
        assertThat(get(NEARBY + "?category=bars&near=18.5,73.9", priya).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get(NEARBY + "?category=cafes&near=nowhere", priya).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get(NEARBY + "?category=cafes", priya).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get(NEARBY + "?category=cafes&near=95,73.9", priya).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(mapbox.requests()).isEmpty();
    }

    @Test
    void nearbyIsLimitedTo20AMinutePerPerson() {
        for (int i = 0; i < 20; i++) {
            assertThat(get(NEARBY + "?category=cafes&near=18.5,73.9", priya).getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        assertThat(get(NEARBY + "?category=cafes&near=18.5,73.9", priya).getStatusCode())
                .isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(mapbox.requests()).hasSize(20);
    }

    @Test
    void mapboxFailingIsReportedAsUnavailableWithoutLeakingThePointOrToken(CapturedOutput output) {
        mapbox.answer(500, "{}");

        ResponseEntity<JsonNode> response = get(NEARBY + "?category=sights&near=18.56789,73.91432", priya);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody().get("code").asText()).isEqualTo("PLACES_UNAVAILABLE");
        assertThat(output.getAll()).contains("Mapbox category search answered 500")
                .doesNotContain(FakeMapbox.TOKEN, "18.56", "73.91");
    }

    @Test
    void nearbyNeedsAnAccount() {
        Map<String, Object> trip = new HashMap<>(Map.of("name", "Trip", "shareHours", 2, "chatEnabled", true));
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(priya);
        String code = rest.exchange("/api/v1/trips", HttpMethod.POST, new HttpEntity<>(trip, headers), JsonNode.class)
                .getBody().get("code").asText();
        String guest = post("/api/v1/join/" + code, Map.of("displayName", "Sourav", "shareLocation", false))
                .getBody().get("accessToken").asText();

        assertThat(get(NEARBY + "?category=cafes&near=18.5,73.9", null).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(get(NEARBY + "?category=cafes&near=18.5,73.9", guest).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(mapbox.requests()).isEmpty();
    }
}
