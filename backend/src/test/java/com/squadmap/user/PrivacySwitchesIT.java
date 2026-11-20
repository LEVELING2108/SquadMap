package com.squadmap.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import com.squadmap.common.geo.GeoMath;
import com.squadmap.trip.service.HistoryForgetting;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.function.BooleanSupplier;

import static org.assertj.core.api.Assertions.assertThat;

/** "Share precise location" and "Keep trip history". */
class PrivacySwitchesIT extends IntegrationTest {

    private static final double DEST_LAT = 18.5622;
    private static final double DEST_LNG = 73.9167;

    @Autowired
    private HistoryForgetting forgetting;

    @Autowired
    private StringRedisTemplate redis;

    private String priya;
    private String aman;
    private String tripId;
    private String code;

    @BeforeEach
    void aTripToPhoenix() {
        priya = signUp("Priya", "priya@example.com");
        aman = signUp("Aman", "aman@example.com");
        JsonNode trip = send(HttpMethod.POST, "/api/v1/trips", priya, Map.of("name", "Saturday at Phoenix",
                "shareHours", 2, "chatEnabled", true,
                "destination", Map.of("name", "Phoenix Marketcity", "lat", DEST_LAT, "lng", DEST_LNG,
                        "fromSearch", false))).getBody();
        tripId = trip.get("id").asText();
        code = trip.get("code").asText();
        send(HttpMethod.POST, "/api/v1/join/" + code, aman, Map.of("shareLocation", true));
    }

    @Test
    void bothAreOnUntilChanged() {
        JsonNode settings = get("/api/v1/me/settings", aman).getBody();
        assertThat(settings.get("preciseLocation").asBoolean()).isTrue();
        assertThat(settings.get("keepHistory").asBoolean()).isTrue();

        JsonNode changed = send(HttpMethod.PATCH, "/api/v1/me/settings", aman,
                Map.of("preciseLocation", false, "keepHistory", false)).getBody();
        assertThat(changed.get("preciseLocation").asBoolean()).isFalse();
        assertThat(changed.get("keepHistory").asBoolean()).isFalse();
    }

    // --- precise location off

    @Test
    void aRoughLocationIsSnappedToAnAreaWithNothingThatNarrowsItDown() {
        Map<String, Object> reading = reading(18.56123, 73.91234, Instant.now());
        reading.put("speed", 4.2);
        reading.put("heading", 90);
        reading.put("approximate", true);

        assertThat(publish(aman, reading).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        JsonNode spot = members(priya).get(1).get("location");
        double[] area = GeoMath.area(18.56123, 73.91234);
        assertThat(spot.get("lat").asDouble()).isEqualTo(area[0]);
        assertThat(spot.get("lng").asDouble()).isEqualTo(area[1]);
        assertThat(spot.get("acc").asDouble()).isEqualTo(150);
        assertThat(spot.get("approx").asBoolean()).isTrue();
        assertThat(spot.has("speed")).isFalse();
        assertThat(spot.has("heading")).isFalse();
    }

    @Test
    void anAreaIsTheSameWhicheverSpotInsideItIsSent() {
        double[] one = GeoMath.area(18.56101, 73.91201);
        double[] two = GeoMath.area(18.56149, 73.91249);
        assertThat(one).containsExactly(two);
        // About 220 m to the next one north.
        double[] north = GeoMath.area(18.56301, 73.91201);
        assertThat(GeoMath.metres(one[0], one[1], north[0], north[1])).isBetween(200.0, 300.0);
    }

    @Test
    void aRoughLocationNeverCountsAsArriving() {
        // As if Aman had been near the destination for 25 seconds already.
        String memberId = jdbc.queryForObject(
                "SELECT m.id::text FROM trip_members m JOIN users u ON u.id = m.user_id WHERE u.email = 'aman@example.com'",
                String.class);
        redis.opsForValue().set("arrive:" + tripId + ":" + memberId, Instant.now().minusSeconds(25).toString());
        Map<String, Object> reading = reading(DEST_LAT, DEST_LNG, Instant.now());
        reading.put("approximate", true);

        publish(aman, reading);

        await(() -> etas().size() == 1);
        assertThat(members(priya).get(1).get("arrivedAt").isNull()).isTrue();
    }

    // --- keep trip history off

    @Test
    void withHistoryOffAFinishedTripLeavesTheHistoryADayLater() {
        send(HttpMethod.PATCH, "/api/v1/me/settings", aman, Map.of("keepHistory", false));
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", priya, Map.of());

        // Right after the end, Trip complete still works.
        assertThat(forgetting.forgetForEveryoneWhoAsked()).isZero();
        assertThat(get("/api/v1/trips/" + tripId + "/summary", aman).getStatusCode()).isEqualTo(HttpStatus.OK);

        jdbc.update("UPDATE trips SET ended_at = now() - interval '25 hours'");
        assertThat(forgetting.forgetForEveryoneWhoAsked()).isEqualTo(1);

        assertThat(get("/api/v1/me/trips", aman).getBody().get("items")).isEmpty();
        assertThat(get("/api/v1/trips/" + tripId + "/summary", aman).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        // Priya keeps hers, with Aman's name as it was.
        JsonNode card = get("/api/v1/me/trips", priya).getBody().get("items").get(0);
        assertThat(card.get("friends").get(0).asText()).isEqualTo("Aman");
    }

    @Test
    void withHistoryOnNothingIsRemoved() {
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", priya, Map.of());
        jdbc.update("UPDATE trips SET ended_at = now() - interval '25 hours'");

        assertThat(forgetting.forgetForEveryoneWhoAsked()).isZero();
        assertThat(get("/api/v1/me/trips", aman).getBody().get("items")).hasSize(1);
    }

    @Test
    void removingPastTripsTakesThemAllNowButKeepsRunningOnes() {
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", priya, Map.of());
        JsonNode running = send(HttpMethod.POST, "/api/v1/trips", priya,
                Map.of("name", "Still going", "shareHours", 2, "chatEnabled", false)).getBody();
        send(HttpMethod.POST, "/api/v1/join/" + running.get("code").asText(), aman, Map.of("shareLocation", false));

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/me/trips/forget", aman, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("removed").asInt()).isEqualTo(1);
        JsonNode items = get("/api/v1/me/trips", aman).getBody().get("items");
        assertThat(items).hasSize(1);
        assertThat(items.get(0).get("name").asText()).isEqualTo("Still going");
        assertThat(get("/api/v1/me/stats", aman).getBody().get("trips").asInt()).isEqualTo(1);
    }

    @Test
    void removingPastTripsIsForAccounts() {
        String guest = send(HttpMethod.POST, "/api/v1/join/" + code, null,
                Map.of("displayName", "Rohan", "shareLocation", false)).getBody().get("accessToken").asText();

        assertThat(send(HttpMethod.POST, "/api/v1/me/trips/forget", guest, null).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    // --- helpers

    private JsonNode members(String token) {
        return get("/api/v1/trips/" + tripId + "/members", token).getBody();
    }

    private JsonNode etas() {
        return get("/api/v1/trips/" + tripId + "/eta", priya).getBody();
    }

    private static void await(BooleanSupplier condition) {
        long until = System.currentTimeMillis() + 5_000;
        while (!condition.getAsBoolean() && System.currentTimeMillis() < until) {
            try {
                Thread.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
    }

    private static Map<String, Object> reading(double lat, double lng, Instant ts) {
        Map<String, Object> reading = new HashMap<>();
        reading.put("lat", lat);
        reading.put("lng", lng);
        reading.put("acc", 8);
        reading.put("ts", ts.toString());
        return reading;
    }

    private ResponseEntity<JsonNode> publish(String token, Map<String, Object> reading) {
        return send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/locations", token, reading);
    }

    private String signUp(String name, String email) {
        return post("/api/v1/auth/signup", Map.of("name", name, "email", email,
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
    }

    private ResponseEntity<JsonNode> send(HttpMethod method, String path, String token, Object body) {
        HttpHeaders headers = new HttpHeaders();
        if (body != null) {
            headers.setContentType(MediaType.APPLICATION_JSON);
        }
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }
}
