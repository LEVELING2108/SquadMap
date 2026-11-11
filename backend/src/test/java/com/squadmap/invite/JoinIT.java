package com.squadmap.invite;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
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

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** Joining from an invite link: the preview, joining as a guest or with an account, and code guessing. */
class JoinIT extends IntegrationTest {

    @Autowired
    private StringRedisTemplate redisTemplate;

    private String hostToken;
    private String tripId;
    private String code;

    @BeforeEach
    void hostATrip() {
        hostToken = signUp("Priya", "priya@example.com");
        JsonNode trip = send(HttpMethod.POST, "/api/v1/trips", hostToken, null, Map.of(
                "name", "Saturday at Phoenix",
                "destination", Map.of("name", "Phoenix Marketcity", "lat", 18.5622, "lng", 73.9167),
                "shareHours", 2, "chatEnabled", true)).getBody();
        tripId = trip.get("id").asText();
        code = trip.get("code").asText();
    }

    private String signUp(String name, String email) {
        return post("/api/v1/auth/signup", Map.of("name", name, "email", email,
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
    }

    private ResponseEntity<JsonNode> send(HttpMethod method, String path, String token, String clientIp, Object body) {
        HttpHeaders headers = new HttpHeaders();
        if (body != null) {
            headers.setContentType(MediaType.APPLICATION_JSON);
        }
        if (token != null) {
            headers.setBearerAuth(token);
        }
        if (clientIp != null) {
            headers.set("X-Forwarded-For", clientIp);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }

    private ResponseEntity<JsonNode> preview(String typedCode, String clientIp) {
        return send(HttpMethod.GET, "/api/v1/join/" + typedCode + "/preview", null, clientIp, null);
    }

    private ResponseEntity<JsonNode> joinAsGuest(String name, boolean share) {
        Map<String, Object> body = new HashMap<>();
        body.put("displayName", name);
        body.put("shareLocation", share);
        return send(HttpMethod.POST, "/api/v1/join/" + code, null, null, body);
    }

    private void endTheTrip() {
        jdbc.update("UPDATE trips SET status = 'ended', ended_at = now() - interval '2 hours'");
    }

    // --- preview ---

    @Test
    void thePreviewShowsWhoInvitedYouAndToWhat() {
        ResponseEntity<JsonNode> response = preview(code, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = response.getBody();
        assertThat(body.get("tripName").asText()).isEqualTo("Saturday at Phoenix");
        assertThat(body.get("hostName").asText()).isEqualTo("Priya");
        assertThat(body.get("destination").get("name").asText()).isEqualTo("Phoenix Marketcity");
        assertThat(body.get("memberCount").asLong()).isEqualTo(1);
    }

    @Test
    void thePreviewRevealsNobodysLocationOrIdentity() {
        String json = preview(code, null).getBody().toString();

        assertThat(json).doesNotContain("priya@example.com").doesNotContain(tripId).doesNotContain("memberId");
    }

    @Test
    void aTypedCodeIsMatchedWhateverItsCaseSpacesOrDashes() {
        String typed = code.substring(0, 4).toLowerCase() + "-" + code.substring(4).toLowerCase();

        assertThat(preview(typed, null).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void anUnknownCodeIsNotFound() {
        ResponseEntity<JsonNode> response = preview("ZZZZZZZZ", null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(response.getBody().get("code").asText()).isEqualTo("INVALID_CODE");
    }

    @Test
    void anImpossibleCodeIsNotFoundToo() {
        assertThat(preview("0000", null).getBody().get("code").asText()).isEqualTo("INVALID_CODE");
    }

    @Test
    void anEndedTripIsGoneAndSaysWhenItEnded() {
        endTheTrip();

        ResponseEntity<JsonNode> response = preview(code, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GONE);
        assertThat(response.getBody().get("code").asText()).isEqualTo("TRIP_EXPIRED");
        Instant endedAt = Instant.parse(response.getBody().get("endedAt").asText());
        assertThat(Duration.between(endedAt, Instant.now())).isBetween(Duration.ofMinutes(119), Duration.ofMinutes(121));
    }

    @Test
    void aTripPastItsTimeIsGoneEvenBeforeTheCleanUpJob() {
        jdbc.update("UPDATE trips SET starts_at = now() - interval '3 hours', expires_at = now() - interval '1 minute'");

        assertThat(preview(code, null).getStatusCode()).isEqualTo(HttpStatus.GONE);
    }

    // --- joining as a guest ---

    @Test
    void aGuestJoinsWithJustANameAndGetsAPassForThisTrip() {
        ResponseEntity<JsonNode> response = joinAsGuest("Aman", true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode body = response.getBody();
        assertThat(body.get("tripId").asText()).isEqualTo(tripId);
        assertThat(body.get("displayName").asText()).isEqualTo("Aman");
        assertThat(body.get("role").asText()).isEqualTo("member");
        assertThat(body.get("color").asText()).matches("#[0-9A-F]{6}");
        assertThat(body.get("accessToken").asText()).isNotBlank();
        assertThat(body.get("expiresIn").asLong()).isBetween(7_100L, 7_200L);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trip_members WHERE user_id IS NULL", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void theGuestPassOpensTheirTrip() {
        String pass = joinAsGuest("Aman", true).getBody().get("accessToken").asText();

        ResponseEntity<JsonNode> trip = send(HttpMethod.GET, "/api/v1/trips/" + tripId, pass, null, null);

        assertThat(trip.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(trip.getBody().get("role").asText()).isEqualTo("member");
        assertThat(trip.getBody().get("memberCount").asLong()).isEqualTo(2);
    }

    @Test
    void theGuestPassOpensNothingElse() {
        String pass = joinAsGuest("Aman", true).getBody().get("accessToken").asText();
        String otherHost = signUp("Rohan", "rohan@example.com");
        String otherTrip = send(HttpMethod.POST, "/api/v1/trips", otherHost, null,
                Map.of("name", "Other trip", "shareHours", 1, "chatEnabled", false)).getBody().get("id").asText();

        assertThat(send(HttpMethod.GET, "/api/v1/trips/" + otherTrip, pass, null, null).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
        assertThat(send(HttpMethod.GET, "/api/v1/trips/" + tripId + "/invite", pass, null, null).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(send(HttpMethod.GET, "/api/v1/trips", pass, null, null).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(send(HttpMethod.POST, "/api/v1/trips", pass, null,
                Map.of("name", "x", "shareHours", 1, "chatEnabled", false)).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(send(HttpMethod.GET, "/api/v1/me", pass, null, null).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void aGuestPassCannotBeUsedToJoinAnotherTrip() {
        String pass = joinAsGuest("Aman", true).getBody().get("accessToken").asText();

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/join/" + code, pass, null,
                Map.of("displayName", "Aman again", "shareLocation", true));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void aGuestMustGiveAName() {
        ResponseEntity<JsonNode> response = joinAsGuest("  ", true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(response.getBody().get("errors").findValuesAsText("field")).contains("displayName");
    }

    @Test
    void choosingToShareRecordsConsentWithThePolicyVersion() {
        String memberId = joinAsGuest("Aman", true).getBody().get("memberId").asText();

        Map<String, Object> consent = jdbc.queryForMap(
                "SELECT trip_member_id::text AS member, policy_version, granted_at FROM consent_log");
        assertThat(consent.get("member")).isEqualTo(memberId);
        assertThat(consent.get("policy_version")).isEqualTo("2026-11");
        assertThat(consent.get("granted_at")).isNotNull();
    }

    @Test
    void notNowJoinsWithoutRecordingConsent() {
        JsonNode body = joinAsGuest("Aman", false).getBody();

        assertThat(body.get("sharingLocation").asBoolean()).isFalse();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM consent_log", Integer.class)).isZero();
    }

    @Test
    void everyoneGetsADifferentColourWhileColoursLast() {
        Set<String> colors = new java.util.HashSet<>();
        colors.add(jdbc.queryForObject("SELECT color FROM trip_members WHERE role = 'host'", String.class));
        for (String name : new String[] {"Aman", "Rohan", "Isha", "Kabir"}) {
            colors.add(joinAsGuest(name, true).getBody().get("color").asText());
        }

        assertThat(colors).hasSizeGreaterThanOrEqualTo(4);
    }

    @Test
    void aTripTakesAtMostTenPeople() {
        for (int i = 1; i < 10; i++) {
            send(HttpMethod.POST, "/api/v1/join/" + code, null, "198.51.100." + i,
                    Map.of("displayName", "Guest " + i, "shareLocation", false));
        }

        ResponseEntity<JsonNode> eleventh = send(HttpMethod.POST, "/api/v1/join/" + code, null, "198.51.100.50",
                Map.of("displayName", "One too many", "shareLocation", false));

        assertThat(eleventh.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(eleventh.getBody().get("code").asText()).isEqualTo("TRIP_FULL");
    }

    @Test
    void nobodyCanJoinAnEndedTrip() {
        endTheTrip();

        ResponseEntity<JsonNode> response = joinAsGuest("Aman", true);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.GONE);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trip_members", Integer.class)).isEqualTo(1);
    }

    // --- joining with an account ---

    @Test
    void aSignedInPersonJoinsAsThemselvesWithoutAGuestPass() {
        String aman = signUp("Aman", "aman@example.com");

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/join/" + code, aman, null,
                Map.of("shareLocation", true));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getBody().get("displayName").asText()).isEqualTo("Aman");
        assertThat(response.getBody().get("accessToken").isNull()).isTrue();
        assertThat(send(HttpMethod.GET, "/api/v1/trips", aman, null, null).getBody().findValuesAsText("id"))
                .containsExactly(tripId);
    }

    @Test
    void joiningTwiceGivesBackTheSamePlace() {
        String aman = signUp("Aman", "aman@example.com");
        String first = send(HttpMethod.POST, "/api/v1/join/" + code, aman, null, Map.of("shareLocation", true))
                .getBody().get("memberId").asText();

        String second = send(HttpMethod.POST, "/api/v1/join/" + code, aman, null, Map.of("shareLocation", true))
                .getBody().get("memberId").asText();

        assertThat(second).isEqualTo(first);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trip_members", Integer.class)).isEqualTo(2);
    }

    @Test
    void theHostOpeningTheirOwnLinkKeepsTheirPlace() {
        JsonNode body = send(HttpMethod.POST, "/api/v1/join/" + code, hostToken, null, Map.of("shareLocation", true))
                .getBody();

        assertThat(body.get("role").asText()).isEqualTo("host");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trip_members", Integer.class)).isEqualTo(1);
    }

    // --- guessing codes ---

    @Test
    void joiningIsLimitedToTenCallsAMinutePerAddress() {
        for (int i = 0; i < 10; i++) {
            assertThat(preview(code, "203.0.113.5").getStatusCode()).isEqualTo(HttpStatus.OK);
        }

        ResponseEntity<JsonNode> eleventh = preview(code, "203.0.113.5");

        assertThat(eleventh.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(preview(code, "203.0.113.6").getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void twentyWrongCodesLockTheAddressOutEvenForARightCode() {
        for (int i = 0; i < 20; i++) {
            if (i % 9 == 0) {
                // Keep the separate per-minute limit out of the way; this test is about wrong codes.
                redisTemplate.delete(redisTemplate.keys("rl:join-ip:*"));
            }
            assertThat(preview("ZZZZZZZZ", "203.0.113.9").getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
        }
        redisTemplate.delete(redisTemplate.keys("rl:join-ip:*"));

        ResponseEntity<JsonNode> rightCode = preview(code, "203.0.113.9");

        assertThat(rightCode.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(rightCode.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isNotBlank();
        assertThat(preview(code, "203.0.113.10").getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void rightCodesDoNotCountTowardsTheLockOut() {
        for (int i = 0; i < 25; i++) {
            if (i % 9 == 0) {
                redisTemplate.delete(redisTemplate.keys("rl:join-ip:*"));
            }
            assertThat(preview(code, "203.0.113.11").getStatusCode()).isEqualTo(HttpStatus.OK);
        }
    }

    @Test
    void aMalformedTripIdInAGuestCallIsNotAnError() {
        String pass = joinAsGuest("Aman", true).getBody().get("accessToken").asText();

        assertThat(send(HttpMethod.GET, "/api/v1/trips/" + UUID.randomUUID(), pass, null, null).getStatusCode())
                .isEqualTo(HttpStatus.NOT_FOUND);
    }
}
