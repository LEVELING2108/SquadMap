package com.squadmap.trip;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

class TripIT extends IntegrationTest {

    private static final String TRIPS = "/api/v1/trips";

    private String priya;
    private String aman;

    @BeforeEach
    void signUp() {
        priya = signUpAs("Priya", "priya@example.com");
        aman = signUpAs("Aman", "aman@example.com");
    }

    private String signUpAs(String name, String email) {
        return post("/api/v1/auth/signup", Map.of("name", name, "email", email,
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
    }

    private ResponseEntity<JsonNode> create(String token, Map<String, ?> body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(token);
        return rest.exchange(TRIPS, HttpMethod.POST, new HttpEntity<>(body, headers), JsonNode.class);
    }

    private static Map<String, Object> phoenixTrip() {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "Saturday at Phoenix");
        body.put("destination", Map.of("name", "Phoenix Marketcity, Viman Nagar", "lat", 18.5622, "lng", 73.9167));
        body.put("shareHours", 2);
        body.put("chatEnabled", true);
        return body;
    }

    // --- creating ---

    @Test
    void creatingATripMakesTheCallerItsHostAndReturnsTheInvite() {
        Instant before = Instant.now();
        ResponseEntity<JsonNode> response = create(priya, phoenixTrip());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode trip = response.getBody();
        assertThat(trip.get("name").asText()).isEqualTo("Saturday at Phoenix");
        assertThat(trip.get("code").asText()).matches("[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{8}");
        assertThat(trip.get("inviteUrl").asText()).isEqualTo("http://localhost:5480/join/" + trip.get("code").asText());
        assertThat(trip.get("destination").get("name").asText()).isEqualTo("Phoenix Marketcity, Viman Nagar");
        assertThat(trip.get("destination").get("lat").asDouble()).isEqualTo(18.5622);
        assertThat(trip.get("chatEnabled").asBoolean()).isTrue();
        assertThat(trip.get("status").asText()).isEqualTo("active");
        assertThat(trip.get("role").asText()).isEqualTo("host");
        assertThat(trip.get("memberCount").asLong()).isEqualTo(1);

        Instant startsAt = Instant.parse(trip.get("startsAt").asText());
        Instant expiresAt = Instant.parse(trip.get("expiresAt").asText());
        assertThat(Duration.between(startsAt, expiresAt)).isEqualTo(Duration.ofHours(2));
        assertThat(Duration.between(before, startsAt).abs()).isLessThan(Duration.ofSeconds(10));
    }

    @Test
    void theHostIsStoredAsTheFirstMemberWithTheirNameAndColour() {
        create(priya, phoenixTrip());

        Map<String, Object> member = jdbc.queryForMap(
                "SELECT m.display_name, m.role, m.color = u.color AS same_color FROM trip_members m "
                        + "JOIN users u ON u.id = m.user_id");
        assertThat(member).containsEntry("display_name", "Priya").containsEntry("role", "host")
                .containsEntry("same_color", true);
    }

    @Test
    void aTripCanStartWithoutADestination() {
        Map<String, Object> body = phoenixTrip();
        body.remove("destination");

        ResponseEntity<JsonNode> response = create(priya, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().get("destination").isNull()).isTrue();
    }

    @ParameterizedTest(name = "{0} hours is allowed")
    @ValueSource(ints = {1, 2, 4, 8})
    void offeredShareDurationsAreAccepted(int hours) {
        Map<String, Object> body = phoenixTrip();
        body.put("shareHours", hours);

        JsonNode trip = create(priya, body).getBody();

        assertThat(Duration.between(Instant.parse(trip.get("startsAt").asText()),
                Instant.parse(trip.get("expiresAt").asText()))).isEqualTo(Duration.ofHours(hours));
    }

    @ParameterizedTest(name = "{0} hours is refused")
    @ValueSource(ints = {0, 3, 12, -1})
    void otherShareDurationsAreRefused(int hours) {
        Map<String, Object> body = phoenixTrip();
        body.put("shareHours", hours);

        ResponseEntity<JsonNode> response = create(priya, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void aBlankNameIsRefused() {
        Map<String, Object> body = phoenixTrip();
        body.put("name", "  \u0001 ");

        assertThat(create(priya, body).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void coordinatesOutsideTheEarthAreRefused() {
        Map<String, Object> body = phoenixTrip();
        body.put("destination", Map.of("name", "Nowhere", "lat", 91, "lng", 73.9));

        ResponseEntity<JsonNode> response = create(priya, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("errors").findValuesAsText("field")).contains("destination.lat");
    }

    @Test
    void aHostCanRunAtMostThreeTripsAtOnce() {
        for (int i = 0; i < 3; i++) {
            assertThat(create(priya, phoenixTrip()).getStatusCode()).isEqualTo(HttpStatus.CREATED);
        }

        ResponseEntity<JsonNode> fourth = create(priya, phoenixTrip());

        assertThat(fourth.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(fourth.getBody().get("code").asText()).isEqualTo("TOO_MANY_TRIPS");
    }

    @Test
    void expiredTripsDoNotCountTowardsTheLimit() {
        for (int i = 0; i < 3; i++) {
            create(priya, phoenixTrip());
        }
        jdbc.update("UPDATE trips SET starts_at = now() - interval '3 hours', expires_at = now() - interval '1 hour'");

        assertThat(create(priya, phoenixTrip()).getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    @Test
    void creatingIsRateLimitedPerAccount() {
        jdbc.update("UPDATE trips SET status = 'ended'");
        for (int i = 0; i < 20; i++) {
            create(priya, phoenixTrip());
            jdbc.update("UPDATE trips SET status = 'ended', ended_at = now()");
        }

        ResponseEntity<JsonNode> response = create(priya, phoenixTrip());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(create(aman, phoenixTrip()).getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }

    // --- reading ---

    @Test
    void myActiveTripsListsOnlyRunningTripsNewestFirst() {
        String older = create(priya, phoenixTrip()).getBody().get("id").asText();
        Map<String, Object> body = phoenixTrip();
        body.put("name", "Sunday brunch");
        String newer = create(priya, body).getBody().get("id").asText();
        String ended = create(priya, phoenixTrip()).getBody().get("id").asText();
        jdbc.update("UPDATE trips SET status = 'ended', ended_at = now() WHERE id = ?::uuid", ended);

        JsonNode list = get(TRIPS + "?status=active", priya).getBody();

        assertThat(list.findValuesAsText("id")).containsExactly(newer, older);
    }

    @Test
    void someoneElsesTripsAreNotListed() {
        create(priya, phoenixTrip());

        assertThat(get(TRIPS, aman).getBody()).isEmpty();
    }

    @Test
    void aMemberCanReadTheTripAndItsInvite() {
        JsonNode created = create(priya, phoenixTrip()).getBody();
        String id = created.get("id").asText();

        JsonNode trip = get(TRIPS + "/" + id, priya).getBody();
        JsonNode invite = get(TRIPS + "/" + id + "/invite", priya).getBody();

        assertThat(trip.get("code").asText()).isEqualTo(created.get("code").asText());
        assertThat(invite.get("code").asText()).isEqualTo(created.get("code").asText());
        assertThat(invite.get("url").asText()).endsWith("/join/" + created.get("code").asText());
        assertThat(invite.get("hostName").asText()).isEqualTo("Priya");
        assertThat(invite.get("tripName").asText()).isEqualTo("Saturday at Phoenix");
    }

    @Test
    void someoneElsesTripLooksTheSameAsATripThatDoesNotExist() {
        String id = create(priya, phoenixTrip()).getBody().get("id").asText();

        ResponseEntity<JsonNode> notMine = get(TRIPS + "/" + id, aman);
        ResponseEntity<JsonNode> missing = get(TRIPS + "/01890000-0000-7000-8000-000000000000", aman);
        ResponseEntity<JsonNode> notMyInvite = get(TRIPS + "/" + id + "/invite", aman);

        assertThat(notMine.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(notMine.getBody().get("code").asText()).isEqualTo("TRIP_NOT_FOUND");
        assertThat(missing.getBody().get("detail")).isEqualTo(notMine.getBody().get("detail"));
        assertThat(notMyInvite.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void aTripPastItsExpiryShowsAsExpiredEvenBeforeTheCleanUpJob() {
        String id = create(priya, phoenixTrip()).getBody().get("id").asText();
        jdbc.update("UPDATE trips SET starts_at = now() - interval '3 hours', expires_at = now() - interval '1 minute'");

        assertThat(get(TRIPS + "/" + id, priya).getBody().get("status").asText()).isEqualTo("expired");
        assertThat(get(TRIPS, priya).getBody()).isEmpty();
    }

    // --- who may call ---

    @Test
    void everyTripRouteNeedsASignedInAccount() {
        assertThat(get(TRIPS, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(post(TRIPS, phoenixTrip()).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(get(TRIPS + "/01890000-0000-7000-8000-000000000000", null).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void aMalformedTripIdIsABadRequestNotAnError() {
        ResponseEntity<JsonNode> response = get(TRIPS + "/not-a-uuid", priya);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void timesAreReturnedInUtc() {
        JsonNode trip = create(priya, phoenixTrip()).getBody();

        assertThat(trip.get("startsAt").asText()).endsWith("Z");
        assertThat(Instant.parse(trip.get("expiresAt").asText()).getEpochSecond())
                .isCloseTo(Instant.now().plus(Duration.ofHours(2)).getEpochSecond(), within(30L));
    }
}
