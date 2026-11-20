package com.squadmap.trip;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import com.squadmap.location.domain.Position;
import com.squadmap.location.service.DistanceStore;
import com.squadmap.trip.service.TripLifecycleService;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** How far each person moved, saved when the trip ends or they leave, and the summary built from it. */
class TripSummaryIT extends IntegrationTest {

    // About 300 m apart, north to south, in Pune.
    private static final double LAT_A = 18.5600;
    private static final double LAT_B = 18.5627;
    private static final double LNG = 73.9100;

    @Autowired
    private DistanceStore distances;

    @Autowired
    private TripLifecycleService lifecycle;

    @Autowired
    private StringRedisTemplate redis;

    private String host;
    private String tripId;
    private String code;

    @BeforeEach
    void startATrip() {
        host = signUp("Priya", "priya@example.com");
        JsonNode trip = send(HttpMethod.POST, "/api/v1/trips", host,
                Map.of("name", "Saturday at Phoenix", "shareHours", 2, "chatEnabled", true)).getBody();
        tripId = trip.get("id").asText();
        code = trip.get("code").asText();
    }

    // --- the distance rules

    @Test
    void addsUpRealMovesOnly() {
        UUID trip = UUID.randomUUID();
        UUID member = UUID.randomUUID();

        distances.record(trip, member, spot(LAT_A, 5));
        assertThat(distances.total(trip, member)).isZero();

        // Wandering within the readings' accuracy is not a move.
        distances.record(trip, member, spot(LAT_A + 0.00008, 5));
        assertThat(distances.total(trip, member)).isZero();

        distances.record(trip, member, spot(LAT_B, 5));
        assertThat(distances.total(trip, member)).isBetween(295, 305);
    }

    @Test
    void slowStepsStillAddUp() {
        UUID trip = UUID.randomUUID();
        UUID member = UUID.randomUUID();
        distances.record(trip, member, spot(LAT_A, 5));

        // Walking: each reading only ~6 m on from the last, too little on its own, but the start stays put.
        for (int step = 1; step <= 10; step++) {
            distances.record(trip, member, spot(LAT_A + step * 0.000054, 5));
        }

        assertThat(distances.total(trip, member)).isBetween(50, 62);
    }

    @Test
    void roughReadingsNeedALongerMove() {
        UUID trip = UUID.randomUUID();
        UUID member = UUID.randomUUID();
        distances.record(trip, member, spot(LAT_A, 100));

        // 100 m on, but both readings could be 100 m off.
        distances.record(trip, member, spot(LAT_A + 0.0009, 100));

        assertThat(distances.total(trip, member)).isZero();
    }

    @Test
    void someoneWhoNeverSharedHasNoDistance() {
        assertThat(distances.total(UUID.randomUUID(), UUID.randomUUID())).isNull();
    }

    // --- through the app

    @Test
    void summaryWhileTheTripRunsShowsTheDistanceSoFar() {
        JsonNode aman = join("Aman", true);
        moveAbout300m(aman.get("accessToken").asText());

        JsonNode summary = summary(aman.get("accessToken").asText()).getBody();

        assertThat(summary.get("status").asText()).isEqualTo("active");
        assertThat(summary.get("endedAt").isNull()).isTrue();
        assertThat(summary.get("distanceM").asInt()).isBetween(295, 305);
        assertThat(summary.get("friendCount").asInt()).isEqualTo(1);
        assertThat(summary.get("role").asText()).isEqualTo("member");
        assertThat(summary.get("name").asText()).isEqualTo("Saturday at Phoenix");
        assertThat(summary.get("durationSeconds").asLong()).isGreaterThanOrEqualTo(0);
        // Totals only, never a place.
        assertThat(summary.toString()).doesNotContain("\"lat\"").doesNotContain("\"lng\"");
    }

    @Test
    void endingTheTripSavesEachDistanceAndForgetsTheRest() {
        JsonNode aman = join("Aman", true);
        String guest = aman.get("accessToken").asText();
        moveAbout300m(guest);

        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, Map.of());

        Integer saved = jdbc.queryForObject("SELECT distance_m FROM trip_members WHERE id = ?::uuid",
                Integer.class, aman.get("memberId").asText());
        assertThat(saved).isBetween(295, 305);
        assertThat(redis.keys("trip:" + tripId + ":dist:*")).isEmpty();

        // The guest still sees how it went, with the pass they had.
        JsonNode summary = summary(guest).getBody();
        assertThat(summary.get("status").asText()).isEqualTo("ended");
        assertThat(summary.get("endedAt").isNull()).isFalse();
        assertThat(summary.get("distanceM").asInt()).isEqualTo(saved);
        // The host never shared.
        JsonNode hosts = summary(host).getBody();
        assertThat(hosts.get("distanceM").isNull()).isTrue();
        assertThat(hosts.get("role").asText()).isEqualTo("host");
        assertThat(hosts.get("friendCount").asInt()).isEqualTo(1);
    }

    @Test
    void aTripThatRunsOutSavesTheDistanceToo() {
        JsonNode aman = join("Aman", true);
        moveAbout300m(aman.get("accessToken").asText());
        jdbc.update("UPDATE trips SET starts_at = now() - interval '2 hours', expires_at = now() - interval '1 second' WHERE id = ?::uuid", tripId);

        lifecycle.expireDueTrips();

        assertThat(jdbc.queryForObject("SELECT distance_m FROM trip_members WHERE id = ?::uuid", Integer.class,
                aman.get("memberId").asText())).isBetween(295, 305);
        assertThat(summary(host).getBody().get("status").asText()).isEqualTo("expired");
    }

    @Test
    void leavingSavesTheDistanceAndTheSummaryStillWorks() {
        String rohan = signUp("Rohan", "rohan@example.com");
        send(HttpMethod.POST, "/api/v1/join/" + code, rohan, Map.of("shareLocation", true));
        moveAbout300m(rohan);

        assertThat(send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", rohan, null)
                .getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        JsonNode summary = summary(rohan).getBody();
        assertThat(summary.get("distanceM").asInt()).isBetween(295, 305);
        assertThat(redis.keys("trip:" + tripId + ":dist:*")).isEmpty();
        // And it shows on their history card once the trip is over.
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, Map.of());
        JsonNode card = get("/api/v1/me/trips", rohan).getBody().get("items").get(0);
        assertThat(card.get("distanceM").asInt()).isBetween(295, 305);
    }

    @Test
    void historyHasNoDistanceForSomeoneWhoNeverShared() {
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, Map.of());

        JsonNode card = get("/api/v1/me/trips", host).getBody().get("items").get(0);

        assertThat(card.get("distanceM").isNull()).isTrue();
    }

    @Test
    void strangersAndOtherTripsGetNothing() {
        String stranger = signUp("Neha", "neha@example.com");
        assertThat(summary(stranger).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(get("/api/v1/trips/" + UUID.randomUUID() + "/summary", host).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(summary(null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);

        // A guest's pass is for its own trip only.
        String guest = join("Aman", false).get("accessToken").asText();
        JsonNode other = send(HttpMethod.POST, "/api/v1/trips", host,
                Map.of("name", "Another", "shareHours", 1, "chatEnabled", false)).getBody();
        assertThat(get("/api/v1/trips/" + other.get("id").asText() + "/summary", guest).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void aGuestCannotUseTheTripOnceItHasEnded() {
        String guest = join("Aman", true).get("accessToken").asText();
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, Map.of());

        // The pass still reads the summary, but sharing a location is refused.
        assertThat(summary(guest).getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/locations", guest,
                reading(LAT_A, Instant.now())).getStatusCode()).isEqualTo(HttpStatus.GONE);
    }

    // --- helpers

    /** Two readings 30 seconds and about 300 m apart: a brisk ride, inside the rate limit. */
    private void moveAbout300m(String token) {
        Instant now = Instant.now();
        assertThat(publish(token, reading(LAT_A, now.minusSeconds(30))).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(publish(token, reading(LAT_B, now)).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    private static Position spot(double lat, double acc) {
        return new Position(lat, LNG, acc, null, null, Instant.now());
    }

    private static Map<String, Object> reading(double lat, Instant ts) {
        Map<String, Object> reading = new HashMap<>();
        reading.put("lat", lat);
        reading.put("lng", LNG);
        reading.put("acc", 5);
        reading.put("ts", ts.toString());
        return reading;
    }

    private ResponseEntity<JsonNode> summary(String token) {
        return get("/api/v1/trips/" + tripId + "/summary", token);
    }

    private ResponseEntity<JsonNode> publish(String token, Map<String, Object> reading) {
        return send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/locations", token, reading);
    }

    private JsonNode join(String name, boolean share) {
        return send(HttpMethod.POST, "/api/v1/join/" + code, null,
                Map.of("displayName", name, "shareLocation", share)).getBody();
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
