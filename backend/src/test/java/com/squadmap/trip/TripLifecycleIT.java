package com.squadmap.trip;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import com.squadmap.trip.service.TripLifecycleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Extending, ending, leaving, guest passes after an extension, the expiry job, and retried creates. */
class TripLifecycleIT extends IntegrationTest {

    @Autowired
    private TripLifecycleService lifecycle;

    private String host;
    private String tripId;
    private String code;

    @BeforeEach
    void startATrip() {
        host = signUp("Priya", "priya@example.com");
        JsonNode trip = send(HttpMethod.POST, "/api/v1/trips", host, Map.of(
                "name", "Saturday at Phoenix", "shareHours", 2, "chatEnabled", true), null).getBody();
        tripId = trip.get("id").asText();
        code = trip.get("code").asText();
    }

    private String signUp(String name, String email) {
        return post("/api/v1/auth/signup", Map.of("name", name, "email", email,
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
    }

    private ResponseEntity<JsonNode> send(HttpMethod method, String path, String token, Object body,
                                          Map<String, String> extraHeaders) {
        HttpHeaders headers = new HttpHeaders();
        if (body != null) {
            headers.setContentType(MediaType.APPLICATION_JSON);
        }
        if (token != null) {
            headers.setBearerAuth(token);
        }
        if (extraHeaders != null) {
            extraHeaders.forEach(headers::set);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }

    private ResponseEntity<JsonNode> extend(String token, int minutes) {
        return send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/extend", token, Map.of("minutes", minutes), null);
    }

    private JsonNode joinAsGuest(String name) {
        return send(HttpMethod.POST, "/api/v1/join/" + code, null,
                Map.of("displayName", name, "shareLocation", true), null).getBody();
    }

    private String joinWithAccount(String name, String email) {
        String token = signUp(name, email);
        send(HttpMethod.POST, "/api/v1/join/" + code, token, Map.of("shareLocation", true), null);
        return token;
    }

    private static Duration length(JsonNode trip) {
        return Duration.between(Instant.parse(trip.get("startsAt").asText()),
                Instant.parse(trip.get("expiresAt").asText()));
    }

    // --- extending ---

    @ParameterizedTest(name = "extending by {0} minutes")
    @ValueSource(ints = {30, 60, 120})
    void theHostCanExtendByTheOfferedAmounts(int minutes) {
        ResponseEntity<JsonNode> response = extend(host, minutes);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(length(response.getBody())).isEqualTo(Duration.ofHours(2).plusMinutes(minutes));
    }

    @Test
    void otherAmountsAreRefused() {
        assertThat(extend(host, 45).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void aTripLastsTwelveHoursAtMost() {
        for (int i = 0; i < 5; i++) {
            assertThat(extend(host, 120).getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        ResponseEntity<JsonNode> tooLong = extend(host, 30);

        assertThat(tooLong.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(tooLong.getBody().get("code").asText()).isEqualTo("EXTEND_LIMIT");
        assertThat(tooLong.getBody().get("maxExtraMinutes").asLong()).isZero();
    }

    @Test
    void theRefusalSaysHowMuchTimeIsLeftToAdd() {
        for (int i = 0; i < 4; i++) {
            extend(host, 120);
        }
        extend(host, 60);

        ResponseEntity<JsonNode> tooLong = extend(host, 120);

        assertThat(tooLong.getBody().get("maxExtraMinutes").asLong()).isEqualTo(60);
        assertThat(tooLong.getBody().get("detail").asText()).contains("1 hour");
        assertThat(extend(host, 60).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void membersCannotExtend() {
        String aman = joinWithAccount("Aman", "aman@example.com");

        ResponseEntity<JsonNode> response = extend(aman, 30);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().get("code").asText()).isEqualTo("NOT_HOST");
    }

    @Test
    void guestsCannotExtend() {
        String pass = joinAsGuest("Aman").get("accessToken").asText();

        assertThat(extend(pass, 30).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void outsidersGetNotFound() {
        String rohan = signUp("Rohan", "rohan@example.com");

        assertThat(extend(rohan, 30).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    @Test
    void anEndedTripCannotBeExtended() {
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null, null);

        assertThat(extend(host, 30).getStatusCode()).isEqualTo(HttpStatus.GONE);
    }

    // --- guest passes after an extension ---

    @Test
    void aGuestRenewsTheirPassToCoverTheExtraTime() {
        JsonNode guest = joinAsGuest("Aman");
        long before = guest.get("expiresIn").asLong();
        extend(host, 60);

        ResponseEntity<JsonNode> renewed = send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/guest-pass",
                guest.get("accessToken").asText(), null, null);

        assertThat(renewed.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(renewed.getBody().get("expiresIn").asLong() - before).isBetween(3_590L, 3_610L);
        assertThat(renewed.getBody().get("memberId").asText()).isEqualTo(guest.get("memberId").asText());
        assertThat(renewed.getBody().get("sharingLocation").asBoolean()).isTrue();
    }

    @Test
    void onlyAGuestCanRenewAPassAndOnlyForTheirTrip() {
        assertThat(send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/guest-pass", host, null, null)
                .getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        String pass = joinAsGuest("Aman").get("accessToken").asText();
        assertThat(send(HttpMethod.POST, "/api/v1/trips/01890000-0000-7000-8000-000000000000/guest-pass", pass,
                null, null).getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // --- ending ---

    @Test
    void theHostEndsTheTripForEveryoneAndTheLinkDies() {
        joinAsGuest("Aman");

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("status").asText()).isEqualTo("ended");
        assertThat(send(HttpMethod.GET, "/api/v1/join/" + code + "/preview", null, null, null).getStatusCode())
                .isEqualTo(HttpStatus.GONE);
        assertThat(send(HttpMethod.GET, "/api/v1/trips", host, null, null).getBody()).isEmpty();
    }

    @Test
    void endingWithdrawsEveryonesLocationConsent() {
        joinAsGuest("Aman");
        joinAsGuest("Rohan");

        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null, null);

        assertThat(jdbc.queryForObject("SELECT count(*) FROM consent_log WHERE withdrawn_at IS NULL", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM consent_log", Integer.class)).isEqualTo(2);
    }

    @Test
    void onlyTheHostCanEnd() {
        String aman = joinWithAccount("Aman", "aman@example.com");

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", aman, null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getBody().get("code").asText()).isEqualTo("NOT_HOST");
    }

    @Test
    void endingTwiceSaysItIsAlreadyOver() {
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null, null);

        assertThat(send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null, null).getStatusCode())
                .isEqualTo(HttpStatus.GONE);
    }

    // --- leaving ---

    @Test
    void aGuestCanLeaveAndTheirPassStopsOpeningTheTrip() {
        String pass = joinAsGuest("Aman").get("accessToken").asText();

        ResponseEntity<JsonNode> response = send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", pass,
                null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(send(HttpMethod.GET, "/api/v1/trips/" + tripId, pass, null, null).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM consent_log WHERE withdrawn_at IS NULL", Integer.class))
                .isZero();
        assertThat(send(HttpMethod.GET, "/api/v1/trips/" + tripId, host, null, null).getBody()
                .get("memberCount").asLong()).isEqualTo(1);
    }

    @Test
    void aMemberWithAnAccountCanLeave() {
        String aman = joinWithAccount("Aman", "aman@example.com");

        assertThat(send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", aman, null, null)
                .getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(send(HttpMethod.GET, "/api/v1/trips", aman, null, null).getBody()).isEmpty();
    }

    @Test
    void someoneWhoLeftCanJoinAgain() {
        String aman = joinWithAccount("Aman", "aman@example.com");
        send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", aman, null, null);

        ResponseEntity<JsonNode> again = send(HttpMethod.POST, "/api/v1/join/" + code, aman,
                Map.of("shareLocation", true), null);

        assertThat(again.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(send(HttpMethod.GET, "/api/v1/trips", aman, null, null).getBody()).hasSize(1);
    }

    @Test
    void theHostCannotLeaveTheirOwnTrip() {
        ResponseEntity<JsonNode> response = send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", host,
                null, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody().get("code").asText()).isEqualTo("HOST_CANNOT_LEAVE");
    }

    @Test
    void leavingATripYouAreNotOnIsNotFound() {
        String rohan = signUp("Rohan", "rohan@example.com");

        assertThat(send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", rohan, null, null)
                .getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
    }

    // --- the expiry job ---

    @Test
    void theJobRecordsTripsWhoseTimeRanOutAndEndsTheirConsent() {
        joinAsGuest("Aman");
        jdbc.update("UPDATE trips SET starts_at = now() - interval '3 hours', expires_at = now() - interval '1 second'");

        int expired = lifecycle.expireDueTrips();

        assertThat(expired).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT status FROM trips", String.class)).isEqualTo("expired");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM consent_log WHERE withdrawn_at IS NULL", Integer.class))
                .isZero();
    }

    @Test
    void theJobLeavesRunningAndEndedTripsAlone() {
        assertThat(lifecycle.expireDueTrips()).isZero();
        assertThat(jdbc.queryForObject("SELECT status FROM trips", String.class)).isEqualTo("active");

        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null, null);
        assertThat(lifecycle.expireDueTrips()).isZero();
        assertThat(jdbc.queryForObject("SELECT status FROM trips", String.class)).isEqualTo("ended");
    }

    // --- retried creates ---

    @Test
    void theSameIdempotencyKeyReturnsTheSameTripInsteadOfASecond() {
        Map<String, Object> body = Map.of("name", "Brunch", "shareHours", 1, "chatEnabled", false);
        Map<String, String> key = Map.of("Idempotency-Key", "tap-1");

        ResponseEntity<JsonNode> first = send(HttpMethod.POST, "/api/v1/trips", host, body, key);
        ResponseEntity<JsonNode> retry = send(HttpMethod.POST, "/api/v1/trips", host, body, key);

        assertThat(first.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(retry.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(retry.getBody().get("id").asText()).isEqualTo(first.getBody().get("id").asText());
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trips WHERE name = 'Brunch'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void differentKeysAndDifferentPeopleAreIndependent() {
        Map<String, Object> body = Map.of("name", "Brunch", "shareHours", 1, "chatEnabled", false);
        String aman = signUp("Aman", "aman@example.com");

        send(HttpMethod.POST, "/api/v1/trips", host, body, Map.of("Idempotency-Key", "tap-1"));
        send(HttpMethod.POST, "/api/v1/trips", host, body, Map.of("Idempotency-Key", "tap-2"));
        send(HttpMethod.POST, "/api/v1/trips", aman, body, Map.of("Idempotency-Key", "tap-1"));

        assertThat(jdbc.queryForObject("SELECT count(*) FROM trips WHERE name = 'Brunch'", Integer.class))
                .isEqualTo(3);
    }

    @Test
    void aFailedCreateCanBeRetriedWithTheSameKey() {
        Map<String, String> key = Map.of("Idempotency-Key", "tap-1");

        ResponseEntity<JsonNode> bad = send(HttpMethod.POST, "/api/v1/trips", host,
                Map.of("name", "Brunch", "shareHours", 3, "chatEnabled", false), key);
        ResponseEntity<JsonNode> good = send(HttpMethod.POST, "/api/v1/trips", host,
                Map.of("name", "Brunch", "shareHours", 1, "chatEnabled", false), key);

        assertThat(bad.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(good.getStatusCode()).isEqualTo(HttpStatus.CREATED);
    }
}
