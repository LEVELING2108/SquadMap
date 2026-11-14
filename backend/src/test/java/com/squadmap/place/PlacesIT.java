package com.squadmap.place;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.FakeMapbox;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.squadmap.FakeMapbox.feature;
import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(OutputCaptureExtension.class)
class PlacesIT extends IntegrationTest {

    private static final String SEARCH = "/api/v1/places/search";
    private static final String RECENT = "/api/v1/places/recent";

    private final FakeMapbox mapbox = FakeMapbox.get();
    private String priya;

    @BeforeEach
    void signUp() {
        priya = signUpAs("Priya", "priya@example.com");
    }

    private String signUpAs(String name, String email) {
        return post("/api/v1/auth/signup", Map.of("name", name, "email", email,
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
    }

    private ResponseEntity<JsonNode> search(String token, String query) {
        return get(SEARCH + "?" + query, token);
    }

    private ResponseEntity<JsonNode> createTrip(String token, Map<String, Object> destination) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "Saturday out");
        body.put("shareHours", 2);
        body.put("chatEnabled", true);
        if (destination != null) {
            body.put("destination", destination);
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);
        return rest.exchange("/api/v1/trips", HttpMethod.POST, new HttpEntity<>(body, headers), JsonNode.class);
    }

    private static Map<String, Object> pin(String name, double lat, double lng) {
        return new HashMap<>(Map.of("name", name, "lat", lat, "lng", lng));
    }

    private static Map<String, Object> searched(String name, double lat, double lng) {
        Map<String, Object> destination = pin(name, lat, lng);
        destination.put("fromSearch", true);
        return destination;
    }

    // --- search ---

    @Test
    void searchReturnsPlacesWithTheirDistanceFromYou() {
        mapbox.answerWith(
                feature("p1", "Phoenix Marketcity", "Viman Nagar, Pune, 411014, India", "poi", 18.5622, 73.9167),
                feature("p2", "Pune", "Maharashtra, India", "place", 18.5204, 73.8567));

        ResponseEntity<JsonNode> response = search(priya, "q=phoenix&near=18.5679,73.9143");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode first = response.getBody().get(0);
        assertThat(first.get("id").asText()).isEqualTo("p1");
        assertThat(first.get("name").asText()).isEqualTo("Phoenix Marketcity");
        assertThat(first.get("address").asText()).isEqualTo("Viman Nagar, Pune, 411014, India");
        assertThat(first.get("lat").asDouble()).isEqualTo(18.5622);
        assertThat(first.get("kind").asText()).isEqualTo("poi");
        assertThat(first.get("distanceMeters").asLong()).isBetween(600L, 750L);
        assertThat(response.getBody()).hasSize(2);
    }

    @Test
    void searchSendsOnlyARoundedLocationAndNeverAsksToStoreResults() {
        search(priya, "q=café bar&near=18.56789,73.91432");

        Map<String, String> sent = mapbox.requests().get(0);
        assertThat(sent.get("q")).isEqualTo("café bar");
        // Longitude first, rounded to two decimals (about 1 km).
        assertThat(sent.get("proximity")).isEqualTo("73.91,18.57");
        assertThat(sent.get("permanent")).isEqualTo("false");
        assertThat(sent.get("autocomplete")).isEqualTo("true");
        assertThat(sent.get("country")).isEqualTo("in");
        assertThat(sent.get("limit")).isEqualTo("6");
        assertThat(sent.get("access_token")).isEqualTo(FakeMapbox.TOKEN);
    }

    @Test
    void searchWithoutALocationGivesNoDistances() {
        mapbox.answerWith(feature("p2", "Pune", "Maharashtra, India", "place", 18.5204, 73.8567));

        JsonNode first = search(priya, "q=pune").getBody().get(0);

        assertThat(first.get("distanceMeters").isNull()).isTrue();
        assertThat(mapbox.requests().get(0)).doesNotContainKey("proximity");
    }

    @Test
    void searchRejectsTextThatIsTooShortOrTooLong() {
        ResponseEntity<JsonNode> tooShort = search(priya, "q=p");
        ResponseEntity<JsonNode> tooLong = search(priya, "q=" + "a".repeat(101));
        ResponseEntity<JsonNode> missing = search(priya, "near=18.5,73.9");

        assertThat(tooShort.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(tooShort.getBody().get("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(tooShort.getBody().get("errors").get(0).get("field").asText()).isEqualTo("q");
        assertThat(tooLong.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(mapbox.requests()).isEmpty();
    }

    @Test
    void searchRejectsALocationThatIsNotLatLng() {
        ResponseEntity<JsonNode> response = search(priya, "q=pune&near=somewhere");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("errors").get(0).get("field").asText()).isEqualTo("near");
    }

    @Test
    void searchNeedsAnAccount() {
        assertThat(search(null, "q=pune").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        String code = createTrip(priya, null).getBody().get("code").asText();
        String guest = post("/api/v1/join/" + code, Map.of("displayName", "Sourav", "shareLocation", false))
                .getBody().get("accessToken").asText();

        assertThat(search(guest, "q=pune").getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get(RECENT, guest).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(mapbox.requests()).isEmpty();
    }

    @Test
    void searchIsLimitedTo30AMinutePerPerson() {
        for (int i = 0; i < 30; i++) {
            assertThat(search(priya, "q=pune").getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        ResponseEntity<JsonNode> limited = search(priya, "q=pune");

        assertThat(limited.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(mapbox.requests()).hasSize(30);
        String aman = signUpAs("Aman", "aman@example.com");
        assertThat(search(aman, "q=pune").getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void mapboxFailingIsReportedAsUnavailableWithoutLeakingTheTokenOrQuery(CapturedOutput output) {
        mapbox.answer(500, "{\"message\":\"boom\"}");

        ResponseEntity<JsonNode> response = search(priya, "q=secret-hideout&near=18.56789,73.91432");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody().get("code").asText()).isEqualTo("PLACES_UNAVAILABLE");
        assertThat(output.getAll()).contains("Mapbox geocoding answered 500")
                .doesNotContain(FakeMapbox.TOKEN, "secret-hideout", "18.56", "73.91");
    }

    @Test
    void aSlowMapboxIsGivenUpOn() {
        mapbox.delay(Duration.ofMillis(1600));

        ResponseEntity<JsonNode> response = search(priya, "q=pune");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(response.getBody().get("code").asText()).isEqualTo("PLACES_UNAVAILABLE");
    }

    // --- saving a destination ---

    @Test
    void aSearchedPlaceIsLookedUpAgainForStorageAndThatVersionIsSaved() {
        mapbox.answerWith(
                feature("far", "Phoenix Marketcity", "Kurla, Mumbai, India", "poi", 19.0866, 72.8890),
                feature("near", "Phoenix Marketcity", "Viman Nagar, Pune, 411014, India", "poi", 18.56225, 73.91672));

        ResponseEntity<JsonNode> response = createTrip(priya,
                searched("Phoenix Marketcity", 18.5622, 73.9167));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode destination = response.getBody().get("destination");
        assertThat(destination.get("name").asText()).isEqualTo("Phoenix Marketcity");
        assertThat(destination.get("lat").asDouble()).isEqualTo(18.56225);
        Map<String, String> sent = mapbox.requests().get(0);
        assertThat(sent.get("permanent")).isEqualTo("true");
        assertThat(sent.get("autocomplete")).isEqualTo("false");
        assertThat(sent.get("q")).isEqualTo("Phoenix Marketcity");
        // The picked place, not a person, so it goes out exactly as picked.
        assertThat(sent.get("proximity")).isEqualTo("73.9167,18.5622");
    }

    @Test
    void aDifferentNearbyPlaceIsNeverSavedInsteadOfThePickedOne() {
        // Only the city comes back, 200 m away: close, but a different place.
        mapbox.answerWith(feature("city", "Pune", "Maharashtra, India", "street", 18.5640, 73.9170));

        ResponseEntity<JsonNode> response = createTrip(priya, searched("Opposite Phoenix Marketcity", 18.5622, 73.9167));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody().get("code").asText()).isEqualTo("PLACE_NOT_CONFIRMED");
    }

    @Test
    void aResultOnTheSameSpotCountsEvenWithAFullerName() {
        mapbox.answerWith(feature("a", "Opposite Phoenix Marketcity 2", "Pune, 411014, India", "address",
                18.56221, 73.91671));

        ResponseEntity<JsonNode> response = createTrip(priya, searched("Opposite Phoenix Marketcity", 18.5622, 73.9167));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().get("destination").get("name").asText())
                .isEqualTo("Opposite Phoenix Marketcity 2");
    }

    @Test
    void aSearchedPlaceThatCannotBeFoundAgainIsRefusedAndNoTripIsMade() {
        mapbox.answerWith(feature("far", "Phoenix Marketcity", "Kurla, Mumbai, India", "poi", 19.0866, 72.8890));

        ResponseEntity<JsonNode> response = createTrip(priya,
                searched("Phoenix Marketcity", 18.5622, 73.9167));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody().get("code").asText()).isEqualTo("PLACE_NOT_CONFIRMED");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trips", Long.class)).isZero();
    }

    @Test
    void aTripIsNotStartedWhileMapboxIsDown() {
        mapbox.answer(503, "{}");

        ResponseEntity<JsonNode> response = createTrip(priya, searched("Pune", 18.52, 73.85));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trips", Long.class)).isZero();
    }

    @Test
    void aDroppedPinIsSavedAsGivenWithoutAskingMapbox() {
        ResponseEntity<JsonNode> response = createTrip(priya, pin("Meeting spot", 18.5, 73.9));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().get("destination").get("name").asText()).isEqualTo("Meeting spot");
        assertThat(mapbox.requests()).isEmpty();
    }

    // --- recent places ---

    @Test
    void recentPlacesAreYourLastDifferentDestinationsNewestFirst() {
        // Up to three trips run at once, so end each one before starting the next.
        for (String name : List.of("Home", "Office", "Home", "Gym", "Cafe", "Park", "Mall")) {
            JsonNode trip = createTrip(priya, pin(name, 18.5, name.equals("Home") ? 73.9 : 73.8)).getBody();
            post("/api/v1/trips/" + trip.get("id").asText() + "/end", priya);
        }
        createTrip(priya, null);
        createTrip(signUpAs("Aman", "aman@example.com"), pin("Aman's secret spot", 18.4, 73.7));

        JsonNode recent = get(RECENT, priya).getBody();

        assertThat(recent.findValuesAsText("name")).containsExactly("Mall", "Park", "Cafe", "Gym", "Home");
        assertThat(recent.get(0).get("kind").asText()).isEqualTo("recent");
        assertThat(recent.get(0).get("lat").asDouble()).isEqualTo(18.5);
    }

    @Test
    void recentPlacesIncludeTripsYouJoined() {
        String aman = signUpAs("Aman", "aman@example.com");
        String code = createTrip(aman, pin("Aman's place", 18.4, 73.7)).getBody().get("code").asText();
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(priya);
        rest.exchange("/api/v1/join/" + code, HttpMethod.POST,
                new HttpEntity<>(Map.of("shareLocation", false), headers), JsonNode.class);

        assertThat(get(RECENT, priya).getBody().findValuesAsText("name")).containsExactly("Aman's place");
    }

    private void post(String path, String token) {
        HttpHeaders headers = new HttpHeaders();
        headers.setBearerAuth(token);
        rest.exchange(path, HttpMethod.POST, new HttpEntity<>(headers), JsonNode.class);
    }
}
