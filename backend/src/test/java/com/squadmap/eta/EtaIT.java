package com.squadmap.eta;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.FakeMapbox;
import com.squadmap.IntegrationTest;
import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.location.LiveClient;
import com.squadmap.trip.service.TripLifecycleService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.BooleanSupplier;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * ETAs and arrival end to end: routes from (fake) Mapbox Directions, the rules that keep Mapbox calls few,
 * estimates when Mapbox can't be used, arrival after 20 seconds near the destination, and clean-up.
 */
class EtaIT extends IntegrationTest {

    /** Phoenix Marketcity, the trip's destination. */
    private static final double DEST_LAT = 18.5622;
    private static final double DEST_LNG = 73.9167;
    /** Location updates are limited to one per 2 seconds on average. */
    private static final long BETWEEN_UPDATES_MS = 2_100;

    @LocalServerPort
    private int port;

    @Autowired
    private StringRedisTemplate redis;

    @Autowired
    private RateLimiter rateLimiter;

    @Autowired
    private TripLifecycleService lifecycle;

    private final List<LiveClient> clients = new ArrayList<>();
    private String host;
    private String tripId;
    private String code;
    private String guest;
    private String guestMemberId;

    @BeforeEach
    void startATripToPhoenix() {
        host = signUp("Priya", "priya@example.com");
        JsonNode trip = send(HttpMethod.POST, "/api/v1/trips", host, Map.of("name", "Saturday at Phoenix",
                "shareHours", 2, "chatEnabled", true,
                "destination", Map.of("name", "Phoenix Marketcity", "lat", DEST_LAT, "lng", DEST_LNG,
                        "fromSearch", false))).getBody();
        tripId = trip.get("id").asText();
        code = trip.get("code").asText();
        JsonNode joined = send(HttpMethod.POST, "/api/v1/join/" + code, null,
                Map.of("displayName", "Aman", "shareLocation", true)).getBody();
        guest = joined.get("accessToken").asText();
        guestMemberId = joined.get("memberId").asText();
    }

    @AfterEach
    void closeClients() {
        clients.forEach(LiveClient::close);
    }

    // --- the ETA itself ---

    @Test
    void anEtaComesFromTheRouteAndReachesEveryone() throws Exception {
        FakeMapbox.get().answerRoute(2400, 420, "route-from-aman");
        LiveClient priya = LiveClient.connect(port, host);
        clients.add(priya);
        priya.subscribe(etaTopic());
        Thread.sleep(200);

        publish(guest, reading(18.5800, 73.9000, null));

        JsonNode live = priya.next(etaTopic(), 5_000);
        assertThat(live).isNotNull();
        assertThat(live.get("memberId").asText()).isEqualTo(guestMemberId);
        assertThat(live.get("distanceM").asLong()).isEqualTo(2400);
        assertThat(live.get("durationS").asLong()).isEqualTo(420);
        assertThat(live.get("mode").asText()).isEqualTo("driving");
        assertThat(live.get("route").asText()).isEqualTo("route-from-aman");
        assertThat(live.get("estimated").asBoolean()).isFalse();
        assertThat(live.get("progress").asDouble()).isZero();
        // From the member to the destination, longitude first, as Mapbox wants.
        assertThat(FakeMapbox.get().directionsPaths())
                .containsExactly("/directions/v5/mapbox/driving/73.900000,18.580000;73.916700,18.562200");
        assertThat(FakeMapbox.get().requests().getFirst()).containsEntry("access_token", FakeMapbox.TOKEN)
                .containsEntry("geometries", "polyline6");
    }

    @Test
    void theSnapshotHasEveryonesEta() {
        publish(guest, reading(18.5800, 73.9000, null));
        await(() -> etas(host).size() == 1);

        JsonNode aman = etas(host).get(0);

        assertThat(aman.get("memberId").asText()).isEqualTo(guestMemberId);
        assertThat(aman.get("durationS").asLong()).isEqualTo(300);
        assertThat(get("/api/v1/trips/" + tripId + "/eta", guest).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void someoneOffTheTripGetsNoEtas() {
        String stranger = signUp("Rohan", "rohan@example.com");

        assertThat(get("/api/v1/trips/" + tripId + "/eta", stranger).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void slowMovementCountsAsWalking() {
        publish(guest, reading(18.5800, 73.9000, 1.2));

        await(() -> etas(host).size() == 1);

        assertThat(etas(host).get(0).get("mode").asText()).isEqualTo("walking");
        assertThat(FakeMapbox.get().directionsPaths().getFirst()).startsWith("/directions/v5/mapbox/walking/");
    }

    @Test
    void progressGrowsAsTheyGetCloser() throws Exception {
        FakeMapbox.get().answerRoute(2000, 400, "first");
        publish(guest, reading(18.5800, 73.9000, null));
        await(() -> etas(host).size() == 1);
        Thread.sleep(BETWEEN_UPDATES_MS);
        FakeMapbox.get().answerRoute(500, 100, "second");

        // About 120 m further on: worth a new route.
        publish(guest, reading(18.5789, 73.9000, null));

        await(() -> etas(host).get(0).get("distanceM").asLong() == 500);
        assertThat(etas(host).get(0).get("progress").asDouble()).isEqualTo(0.75);
    }

    @Test
    void aTripWithoutADestinationHasNoEtas() {
        JsonNode trip = send(HttpMethod.POST, "/api/v1/trips", host,
                Map.of("name", "Anywhere", "shareHours", 1, "chatEnabled", false)).getBody();
        String other = trip.get("id").asText();
        String rohan = send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), null,
                Map.of("displayName", "Rohan", "shareLocation", true)).getBody().get("accessToken").asText();

        send(HttpMethod.POST, "/api/v1/trips/" + other + "/locations", rohan, reading(18.58, 73.90, null));

        pause(1_000);
        assertThat(get("/api/v1/trips/" + other + "/eta", host).getBody()).isEmpty();
        assertThat(FakeMapbox.get().directionsPaths()).isEmpty();
    }

    // --- keeping Mapbox calls few ---

    @Test
    void barelyMovingDoesNotAskForANewRoute() throws Exception {
        publish(guest, reading(18.5800, 73.9000, null));
        await(() -> etas(host).size() == 1);
        Thread.sleep(BETWEEN_UPDATES_MS);

        // About 20 m on, a few seconds later.
        publish(guest, reading(18.5802, 73.9000, null));

        pause(1_000);
        assertThat(FakeMapbox.get().directionsPaths()).hasSize(1);
    }

    @Test
    void friendsSettingOffFromTheSameSpotShareOneRoute() {
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/sharing", host, null);
        publish(guest, reading(18.5800, 73.9000, null));
        await(() -> etas(host).size() == 1);

        // Priya is in the same car, 10 m away.
        publish(host, reading(18.58008, 73.9000, null));

        await(() -> etas(host).size() == 2);
        assertThat(FakeMapbox.get().directionsPaths()).hasSize(1);
    }

    @Test
    void overTheTripsBudgetTheEtaIsEstimated() {
        for (int i = 0; i < RateLimit.DIRECTIONS_PER_TRIP.capacity(); i++) {
            rateLimiter.check(RateLimit.DIRECTIONS_PER_TRIP, tripId);
        }

        publish(guest, reading(18.5800, 73.9000, null));

        await(() -> etas(host).size() == 1);
        JsonNode eta = etas(host).get(0);
        assertThat(eta.get("estimated").asBoolean()).isTrue();
        assertThat(eta.has("route")).isFalse();
        assertThat(eta.get("distanceM").asLong()).isGreaterThan(2_500);
        assertThat(FakeMapbox.get().directionsPaths()).isEmpty();
    }

    @Test
    void whenMapboxFailsTheEtaIsEstimated() {
        FakeMapbox.get().answerDirections(500, "{}");

        publish(guest, reading(18.5800, 73.9000, null));

        await(() -> etas(host).size() == 1);
        assertThat(etas(host).get(0).get("estimated").asBoolean()).isTrue();
    }

    // --- arrival ---

    @Test
    void twentySecondsNearTheDestinationIsAnArrival() throws Exception {
        LiveClient priya = LiveClient.connect(port, host);
        clients.add(priya);
        priya.subscribe(eventsTopic());
        Thread.sleep(200);
        publish(guest, reading(18.5624, 73.9168, null));
        await(() -> insideSince() != null);
        // As if the first reading near the destination had come 25 seconds ago.
        redis.opsForValue().set(arriveKey(), Instant.now().minusSeconds(25).toString());
        Thread.sleep(BETWEEN_UPDATES_MS);

        publish(guest, reading(18.5623, 73.9167, null));

        JsonNode arrived = priya.next(eventsTopic(), 5_000);
        assertThat(arrived.get("type").asText()).isEqualTo("ARRIVED");
        assertThat(arrived.get("displayName").asText()).isEqualTo("Aman");
        JsonNode aman = get("/api/v1/trips/" + tripId + "/members", host).getBody().get(1);
        assertThat(aman.get("arrivedAt").isNull()).isFalse();
        assertThat(etas(host)).isEmpty();

        // Arriving again announces nothing.
        Thread.sleep(BETWEEN_UPDATES_MS);
        publish(guest, reading(18.5622, 73.9167, null));
        assertThat(priya.next(eventsTopic(), 1_000)).isNull();
    }

    @Test
    void passingByIsNotAnArrival() throws Exception {
        publish(guest, reading(18.5624, 73.9168, null));
        await(() -> insideSince() != null);
        Thread.sleep(BETWEEN_UPDATES_MS);

        // Out of the 60 m circle again: the 20 seconds start over next time.
        publish(guest, reading(18.5630, 73.9168, null));

        await(() -> insideSince() == null);
        JsonNode aman = get("/api/v1/trips/" + tripId + "/members", host).getBody().get(1);
        assertThat(aman.get("arrivedAt").isNull()).isTrue();
    }

    // --- clean-up ---

    @Test
    void leavingOrEndingDeletesEtas() {
        publish(guest, reading(18.5800, 73.9000, null));
        await(() -> etas(host).size() == 1);

        send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", guest, null);

        assertThat(redis.hasKey("eta:" + tripId + ":" + guestMemberId)).isFalse();
    }

    @Test
    void runningOutOfTimeDeletesEtas() {
        publish(guest, reading(18.5800, 73.9000, null));
        await(() -> etas(host).size() == 1);
        jdbc.update("UPDATE trips SET starts_at = now() - interval '3 hours', expires_at = now() - interval '1 second'");

        lifecycle.expireDueTrips();

        assertThat(redis.hasKey("eta:" + tripId + ":" + guestMemberId)).isFalse();
    }

    // --- helpers ---

    private String etaTopic() {
        return "/topic/trip." + tripId + ".eta";
    }

    private String eventsTopic() {
        return "/topic/trip." + tripId + ".events";
    }

    private String arriveKey() {
        return "arrive:" + tripId + ":" + guestMemberId;
    }

    private String insideSince() {
        return redis.opsForValue().get(arriveKey());
    }

    private JsonNode etas(String token) {
        return get("/api/v1/trips/" + tripId + "/eta", token).getBody();
    }

    private static Map<String, Object> reading(double lat, double lng, Double speed) {
        Map<String, Object> reading = new HashMap<>();
        reading.put("lat", lat);
        reading.put("lng", lng);
        reading.put("acc", 8);
        if (speed != null) {
            reading.put("speed", speed);
        }
        reading.put("ts", Instant.now().toString());
        return reading;
    }

    private void publish(String token, Map<String, Object> reading) {
        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/locations", token,
                reading);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    /** ETAs are worked out in the background, so tests wait for the result. */
    private static void await(BooleanSupplier condition) {
        long until = System.currentTimeMillis() + 5_000;
        while (!condition.getAsBoolean()) {
            if (System.currentTimeMillis() > until) {
                throw new AssertionError("Condition not met within 5 seconds");
            }
            pause(50);
        }
    }

    private static void pause(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
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
