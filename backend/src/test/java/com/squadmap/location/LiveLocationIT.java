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
 * The live map end to end: real STOMP clients on the live connection, the REST snapshot and fallback,
 * who may see and send what, the checks on each reading, and spots disappearing when they should.
 */
class LiveLocationIT extends IntegrationTest {

    /** The product promise is 3 seconds; locally it takes milliseconds. */
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
    void startATripWithAGuest() {
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

    // --- seeing each other ---

    @Test
    void membersSeeEachOthersLocationOnTheLiveConnection() throws Exception {
        assertThat(startSharing(host).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        LiveClient priya = live(host);
        LiveClient aman = live(guest);
        priya.subscribe(locations());
        aman.subscribe(locations());
        Thread.sleep(200);

        aman.send("/app/trip." + tripId + ".loc", reading(18.5679, 73.9143, 12));

        JsonNode seen = priya.next(locations(), WAIT_MS);
        assertThat(seen).isNotNull();
        assertThat(seen.get("memberId").asText()).isEqualTo(guestMemberId);
        assertThat(seen.get("lat").asDouble()).isEqualTo(18.5679);
        assertThat(seen.get("lng").asDouble()).isEqualTo(73.9143);
        assertThat(seen.get("acc").asDouble()).isEqualTo(12);
        // The sender hears its own update too, which confirms it arrived.
        assertThat(aman.next(locations(), WAIT_MS)).isNotNull();
    }

    @Test
    void theSnapshotHasEveryoneAndTheFreshSpots() {
        publish(guest, reading(18.5679, 73.9143, 12));

        JsonNode members = get("/api/v1/trips/" + tripId + "/members", host).getBody();

        assertThat(members).hasSize(2);
        JsonNode priya = members.get(0);
        JsonNode aman = members.get(1);
        assertThat(priya.get("displayName").asText()).isEqualTo("Priya");
        assertThat(priya.get("you").asBoolean()).isTrue();
        assertThat(priya.get("role").asText()).isEqualTo("host");
        // The host never agreed to share, so has no spot yet.
        assertThat(priya.get("sharing").asBoolean()).isFalse();
        assertThat(priya.get("location").isNull()).isTrue();
        assertThat(aman.get("memberId").asText()).isEqualTo(guestMemberId);
        assertThat(aman.get("you").asBoolean()).isFalse();
        assertThat(aman.get("sharing").asBoolean()).isTrue();
        assertThat(aman.get("location").get("lat").asDouble()).isEqualTo(18.5679);
        assertThat(aman.get("color").asText()).startsWith("#");
    }

    @Test
    void aGuestCanLoadTheSnapshotOfTheirOwnTrip() {
        ResponseEntity<JsonNode> response = get("/api/v1/trips/" + tripId + "/members", guest);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get(1).get("you").asBoolean()).isTrue();
    }

    @Test
    void someoneOffTheTripGetsNoSnapshot() {
        String stranger = signUp("Rohan", "rohan@example.com");

        ResponseEntity<JsonNode> response = get("/api/v1/trips/" + tripId + "/members", stranger);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().get("code").asText()).isEqualTo("TRIP_NOT_FOUND");
    }

    @Test
    void positionsAreKeptForTenMinutesAtMost() {
        publish(guest, reading(18.5679, 73.9143, 12));

        Long ttl = redis.getExpire("trip:" + tripId + ":loc:" + guestMemberId);

        assertThat(ttl).isBetween(590L, 600L);
    }

    // --- who may connect, subscribe and send ---

    @Test
    void connectingWithoutATokenIsRefused() throws Exception {
        LiveClient nobody = live(null);

        assertThat(nobody.nextError(WAIT_MS)).isEqualTo("UNAUTHENTICATED");
        assertThat(nobody.connected()).isFalse();
    }

    @Test
    void connectingWithABadTokenIsRefused() throws Exception {
        LiveClient forged = live(host.substring(0, host.length() - 4) + "AAAA");

        assertThat(forged.nextError(WAIT_MS)).isEqualTo("UNAUTHENTICATED");
    }

    @Test
    void someoneOffTheTripCannotListenToIt() throws Exception {
        LiveClient rohan = live(signUp("Rohan", "rohan@example.com"));
        assertThat(rohan.connected()).isTrue();

        rohan.subscribe(locations());

        assertThat(rohan.nextError(WAIT_MS)).isEqualTo("TRIP_NOT_FOUND");
    }

    @Test
    void aGuestCannotListenToAnotherTrip() throws Exception {
        String otherHost = signUp("Rohan", "rohan@example.com");
        String otherTrip = send(HttpMethod.POST, "/api/v1/trips", otherHost,
                Map.of("name", "Other trip", "shareHours", 1, "chatEnabled", false)).getBody().get("id").asText();
        LiveClient aman = live(guest);

        aman.subscribe("/topic/trip." + otherTrip + ".locations");

        assertThat(aman.nextError(WAIT_MS)).isEqualTo("TRIP_NOT_FOUND");
    }

    @Test
    void onlyTripTopicsCanBeSubscribedTo() throws Exception {
        LiveClient priya = live(host);

        priya.subscribe("/topic/everything");

        assertThat(priya.nextError(WAIT_MS)).isEqualTo("FORBIDDEN");
    }

    @Test
    void clientsCannotPublishStraightToATopic() throws Exception {
        LiveClient priya = live(host);
        LiveClient aman = live(guest);
        aman.subscribe(locations());
        Thread.sleep(200);

        priya.send(locations(), Map.of("memberId", guestMemberId, "lat", 0, "lng", 0));

        assertThat(priya.nextError(WAIT_MS)).isEqualTo("FORBIDDEN");
        assertThat(aman.next(locations(), 500)).isNull();
    }

    @Test
    void anUpdateFromSomeoneNotSharingIsRefusedToThemAlone() throws Exception {
        LiveClient priya = live(host);
        priya.subscribe("/user/queue/errors");
        priya.subscribe(locations());
        Thread.sleep(200);

        priya.send("/app/trip." + tripId + ".loc", reading(18.5679, 73.9143, 12));

        JsonNode error = priya.next("/user/queue/errors", WAIT_MS);
        assertThat(error.get("code").asText()).isEqualTo("NOT_SHARING");
        assertThat(priya.next(locations(), 500)).isNull();
        assertThat(priya.connected()).isTrue();
    }

    @Test
    void startingToShareRecordsConsentAndTellsTheTrip() throws Exception {
        LiveClient aman = live(guest);
        aman.subscribe(events());
        Thread.sleep(200);

        startSharing(host);
        // Again changes nothing.
        assertThat(startSharing(host).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        JsonNode event = aman.next(events(), WAIT_MS);
        assertThat(event.get("type").asText()).isEqualTo("SHARING_STARTED");
        assertThat(event.get("displayName").asText()).isEqualTo("Priya");
        assertThat(aman.next(events(), 500)).isNull();
        assertThat(publish(host, reading(18.56, 73.91, 10)).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM consent_log WHERE withdrawn_at IS NULL", Integer.class))
                .isEqualTo(2);
    }

    @Test
    void someoneWhoSaidNotNowCannotSendUntilTheyShare() {
        String rohan = join("Rohan", false).get("accessToken").asText();

        ResponseEntity<JsonNode> refused = publish(rohan, reading(18.5679, 73.9143, 12));
        assertThat(refused.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(refused.getBody().get("code").asText()).isEqualTo("NOT_SHARING");

        startSharing(rohan);

        assertThat(publish(rohan, reading(18.5679, 73.9143, 12)).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    // --- checks on each reading ---

    @Test
    void roughReadingsAreRefused() {
        ResponseEntity<JsonNode> response = publish(guest, reading(18.5679, 73.9143, 450));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody().get("code").asText()).isEqualTo("LOCATION_REJECTED");
    }

    @Test
    void readingsFromTheFutureOrLongAgoAreRefused() {
        Map<String, Object> future = reading(18.5679, 73.9143, 10);
        future.put("ts", Instant.now().plusSeconds(120).toString());
        Map<String, Object> old = reading(18.5679, 73.9143, 10);
        old.put("ts", Instant.now().minusSeconds(600).toString());

        assertThat(publish(guest, future).getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(publish(guest, old).getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
    }

    @Test
    void placesOffTheEarthAndMissingFieldsAreRefused() {
        assertThat(publish(guest, reading(91, 73.9, 10)).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(publish(guest, Map.of("lat", 18.5, "lng", 73.9)).getStatusCode())
                .isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void anImpossibleJumpIsRefused() throws Exception {
        publish(guest, reading(18.5679, 73.9143, 10));
        Thread.sleep(2_100);

        // Mumbai, two seconds later.
        ResponseEntity<JsonNode> response = publish(guest, reading(19.0760, 72.8777, 10));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNPROCESSABLE_ENTITY);
        assertThat(response.getBody().get("detail").asText()).contains("too far");
    }

    @Test
    void anOlderReadingThanTheKeptOneIsIgnored() {
        Map<String, Object> newer = reading(18.5679, 73.9143, 10);
        Map<String, Object> older = reading(18.5600, 73.9100, 10);
        older.put("ts", Instant.now().minusSeconds(30).toString());
        publish(guest, newer);

        assertThat(publish(guest, older).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        JsonNode aman = get("/api/v1/trips/" + tripId + "/members", host).getBody().get(1);
        assertThat(aman.get("location").get("lat").asDouble()).isEqualTo(18.5679);
    }

    @Test
    void moreThanOneUpdatePerTwoSecondsIsRateLimited() {
        assertThat(publish(guest, reading(18.5679, 73.9143, 10)).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(publish(guest, reading(18.5680, 73.9143, 10)).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);

        ResponseEntity<JsonNode> third = publish(guest, reading(18.5681, 73.9143, 10));

        assertThat(third.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(third.getBody().get("code").asText()).isEqualTo("RATE_LIMITED");
    }

    @Test
    void theSenderHearsWhyAnUpdateOnTheLiveConnectionWasRefused() throws Exception {
        LiveClient aman = live(guest);
        aman.subscribe("/user/queue/errors");
        Thread.sleep(200);

        aman.send("/app/trip." + tripId + ".loc", reading(18.5679, 73.9143, 450));

        JsonNode error = aman.next("/user/queue/errors", WAIT_MS);
        assertThat(error.get("code").asText()).isEqualTo("LOCATION_REJECTED");
        assertThat(aman.connected()).isTrue();
    }

    // --- spots disappear when sharing must stop ---

    @Test
    void endingTheTripDeletesEverySpotAndTellsEveryone() throws Exception {
        LiveClient aman = live(guest);
        aman.subscribe(events());
        Thread.sleep(200);
        publish(guest, reading(18.5679, 73.9143, 10));

        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null);

        assertThat(aman.next(events(), WAIT_MS).get("type").asText()).isEqualTo("TRIP_ENDED");
        assertThat(redis.hasKey("trip:" + tripId + ":loc:" + guestMemberId)).isFalse();
        assertThat(publish(guest, reading(18.5679, 73.9143, 10)).getStatusCode()).isEqualTo(HttpStatus.GONE);
    }

    @Test
    void anEndedTripCannotBeListenedTo() throws Exception {
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null);
        LiveClient priya = live(host);

        priya.subscribe(locations());

        assertThat(priya.nextError(WAIT_MS)).isEqualTo("TRIP_EXPIRED");
    }

    @Test
    void runningOutOfTimeDeletesEverySpotToo() throws Exception {
        LiveClient aman = live(guest);
        aman.subscribe(events());
        Thread.sleep(200);
        publish(guest, reading(18.5679, 73.9143, 10));
        jdbc.update("UPDATE trips SET starts_at = now() - interval '3 hours', expires_at = now() - interval '1 second'");

        lifecycle.expireDueTrips();

        assertThat(aman.next(events(), WAIT_MS).get("type").asText()).isEqualTo("TRIP_ENDED");
        assertThat(redis.hasKey("trip:" + tripId + ":loc:" + guestMemberId)).isFalse();
    }

    @Test
    void leavingDeletesTheSpotAndTellsTheTrip() throws Exception {
        LiveClient priya = live(host);
        priya.subscribe(events());
        Thread.sleep(200);
        publish(guest, reading(18.5679, 73.9143, 10));

        send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", guest, null);

        JsonNode event = priya.next(events(), WAIT_MS);
        assertThat(event.get("type").asText()).isEqualTo("MEMBER_LEFT");
        assertThat(event.get("memberId").asText()).isEqualTo(guestMemberId);
        assertThat(redis.hasKey("trip:" + tripId + ":loc:" + guestMemberId)).isFalse();
    }

    @Test
    void joiningAndExtendingAreAnnounced() throws Exception {
        LiveClient priya = live(host);
        priya.subscribe(events());
        Thread.sleep(200);

        join("Rohan", true);
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/extend", host, Map.of("minutes", 30));

        JsonNode joined = priya.next(events(), WAIT_MS);
        assertThat(joined.get("type").asText()).isEqualTo("MEMBER_JOINED");
        assertThat(joined.get("displayName").asText()).isEqualTo("Rohan");
        JsonNode extended = priya.next(events(), WAIT_MS);
        assertThat(extended.get("type").asText()).isEqualTo("TRIP_EXTENDED");
        assertThat(extended.has("expiresAt")).isTrue();
    }

    // --- helpers ---

    private LiveClient live(String token) {
        LiveClient client = LiveClient.connect(port, token);
        clients.add(client);
        return client;
    }

    private String locations() {
        return "/topic/trip." + tripId + ".locations";
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

    private ResponseEntity<JsonNode> startSharing(String token) {
        return send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/sharing", token, null);
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
