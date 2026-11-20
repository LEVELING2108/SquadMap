package com.squadmap.location;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pausing location sharing: friends keep the last spot until the person resumes, leaves or the trip ends,
 * nothing new is accepted meanwhile, the ETA goes, and everyone hears about it.
 */
class PauseLocationIT extends IntegrationTest {

    private static final long WAIT_MS = 3_000;

    @LocalServerPort
    private int port;

    @Autowired
    private TripLifecycleService lifecycle;

    @Autowired
    private StringRedisTemplate redis;

    private final List<LiveClient> clients = new ArrayList<>();

    private String host;
    private String tripId;
    private String code;
    private String guest;
    private String guestMemberId;

    @BeforeEach
    void startATripWithASharingGuest() {
        host = signUp("Priya", "priya@example.com");
        JsonNode trip = send(HttpMethod.POST, "/api/v1/trips", host,
                Map.of("name", "Saturday at Phoenix", "shareHours", 2, "chatEnabled", true)).getBody();
        tripId = trip.get("id").asText();
        code = trip.get("code").asText();
        JsonNode joined = join("Aman", true);
        guest = joined.get("accessToken").asText();
        guestMemberId = joined.get("memberId").asText();
    }

    @AfterEach
    void closeClients() {
        clients.forEach(LiveClient::close);
    }

    @Test
    void pausingKeepsTheLastSpotForFriendsAndTellsThem() throws Exception {
        LiveClient priya = live(host);
        priya.subscribe(events());
        Thread.sleep(200);
        publish(guest, reading(18.5679, 73.9143, 10));

        assertThat(pause(guest, true).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        JsonNode event = priya.next(events(), WAIT_MS);
        assertThat(event.get("type").asText()).isEqualTo("PAUSED");
        assertThat(event.get("memberId").asText()).isEqualTo(guestMemberId);
        assertThat(event.get("displayName").asText()).isEqualTo("Aman");
        // No longer runs out after 10 minutes.
        assertThat(redis.getExpire(spotKey())).isEqualTo(-1L);
        JsonNode aman = get("/api/v1/trips/" + tripId + "/members", host).getBody().get(1);
        assertThat(aman.get("sharing").asBoolean()).isTrue();
        assertThat(aman.get("pausedAt").isNull()).isFalse();
        assertThat(aman.get("location").get("lat").asDouble()).isEqualTo(18.5679);
    }

    @Test
    void locationsSentWhilePausedAreRefusedAndNotKept() {
        publish(guest, reading(18.5679, 73.9143, 10));
        pause(guest, true);

        ResponseEntity<JsonNode> response = publish(guest, reading(18.5690, 73.9150, 10));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("code").asText()).isEqualTo("PAUSED");
        JsonNode aman = get("/api/v1/trips/" + tripId + "/members", host).getBody().get(1);
        assertThat(aman.get("location").get("lat").asDouble()).isEqualTo(18.5679);
    }

    @Test
    void resumingLetsTheOldSpotAgeOutAndAcceptsNewOnes() throws Exception {
        LiveClient priya = live(host);
        priya.subscribe(events());
        Thread.sleep(200);
        publish(guest, reading(18.5679, 73.9143, 10));
        pause(guest, true);
        priya.next(events(), WAIT_MS);

        assertThat(pause(guest, false).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        assertThat(priya.next(events(), WAIT_MS).get("type").asText()).isEqualTo("RESUMED");
        assertThat(redis.getExpire(spotKey())).isBetween(590L, 600L);
        JsonNode aman = get("/api/v1/trips/" + tripId + "/members", host).getBody().get(1);
        assertThat(aman.get("pausedAt").isNull()).isTrue();
        Thread.sleep(2_100);
        assertThat(publish(guest, reading(18.5690, 73.9150, 10)).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void pausingRemovesTheEta() {
        publish(guest, reading(18.5679, 73.9143, 10));
        String etaKey = "eta:" + tripId + ":" + guestMemberId;
        redis.opsForValue().set(etaKey, "{}");

        pause(guest, true);

        assertThat(redis.hasKey(etaKey)).isFalse();
    }

    @Test
    void doingItAgainChangesNothing() throws Exception {
        LiveClient priya = live(host);
        priya.subscribe(events());
        Thread.sleep(200);
        pause(guest, true);
        priya.next(events(), WAIT_MS);

        assertThat(pause(guest, true).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        // Only the first pause is announced.
        assertThat(priya.next(events(), 500)).isNull();
    }

    @Test
    void someoneNotSharingCannotPause() {
        ResponseEntity<JsonNode> response = pause(host, true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().get("code").asText()).isEqualTo("NOT_SHARING");
    }

    @Test
    void anAccountCanPauseToo() {
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/sharing", host, null);

        assertThat(pause(host, true).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(get("/api/v1/trips/" + tripId + "/members", host).getBody().get(0).get("pausedAt").isNull())
                .isFalse();
    }

    @Test
    void theRequestMustSayWhichWay() {
        ResponseEntity<JsonNode> response = send(HttpMethod.PUT,
                "/api/v1/trips/" + tripId + "/members/me/pause", guest, Map.of());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void someoneOffTheTripCannotPauseOnIt() {
        String stranger = signUp("Rohan", "rohan@example.com");

        assertThat(pause(stranger, true).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void moreThanTenChangesAMinuteAreRateLimited() {
        for (int i = 0; i < 10; i++) {
            assertThat(pause(guest, i % 2 == 0).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        }

        ResponseEntity<JsonNode> response = pause(guest, true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void leavingDeletesAPausedSpot() {
        publish(guest, reading(18.5679, 73.9143, 10));
        pause(guest, true);

        send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", guest, null);

        assertThat(redis.hasKey(spotKey())).isFalse();
    }

    @Test
    void endingOrRunningOutDeletesAPausedSpot() {
        publish(guest, reading(18.5679, 73.9143, 10));
        pause(guest, true);
        jdbc.update("UPDATE trips SET starts_at = now() - interval '3 hours', expires_at = now() - interval '1 second'");

        lifecycle.expireDueTrips();

        assertThat(redis.hasKey(spotKey())).isFalse();
    }

    @Test
    void anEndedTripCannotBePausedOn() {
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null);

        ResponseEntity<JsonNode> response = pause(guest, true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GONE);
    }

    // --- helpers ---

    private ResponseEntity<JsonNode> pause(String token, boolean paused) {
        return send(HttpMethod.PUT, "/api/v1/trips/" + tripId + "/members/me/pause", token, Map.of("paused", paused));
    }

    private String spotKey() {
        return "trip:" + tripId + ":loc:" + guestMemberId;
    }

    private LiveClient live(String token) {
        LiveClient client = LiveClient.connect(port, token);
        clients.add(client);
        return client;
    }

    private String events() {
        return "/topic/trip." + tripId + ".events";
    }

    private static Map<String, Object> reading(double lat, double lng, double acc) {
        Map<String, Object> reading = new HashMap<>();
        reading.put("lat", lat);
        reading.put("lng", lng);
        reading.put("acc", acc);
        reading.put("ts", Instant.now().toString());
        return reading;
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
