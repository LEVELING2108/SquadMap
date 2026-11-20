package com.squadmap.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import com.squadmap.Mailpit;
import com.squadmap.auth.service.AccountPurge;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** Download my data, and deleting an account: closed at once, removable for 30 days, then anonymised. */
class PrivacyIT extends IntegrationTest {

    private static final String PASSWORD = "correct horse battery";

    @Autowired
    private AccountPurge purge;

    private String priya;
    private String priyasRefresh;
    private String aman;

    @BeforeEach
    void twoFriends() {
        ResponseEntity<JsonNode> signedUp = post("/api/v1/auth/signup", Map.of("name", "Priya",
                "email", "priya@example.com", "password", PASSWORD, "acceptedTerms", true));
        priya = signedUp.getBody().get("accessToken").asText();
        priyasRefresh = signedUp.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE).stream()
                .filter(cookie -> cookie.startsWith("sm_refresh=")).findFirst().orElseThrow()
                .split(";")[0];
        aman = signUp("Aman", "aman@example.com");
    }

    // --- download my data

    @Test
    void exportsEverythingKeptAboutTheAccountAsAFile() {
        JsonNode trip = createTrip(priya, "Saturday at Phoenix");
        join(aman, trip, true);
        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/messages", aman,
                Map.of("text", "On my way", "clientId", "6f1c0b52-6a3e-4a8e-9a43-3b1c2f8a7d10"));
        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/end", priya, Map.of());

        ResponseEntity<JsonNode> response = get("/api/v1/me/export", aman);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION))
                .isEqualTo("attachment; filename=\"squadmap-data.json\"");
        assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        JsonNode data = response.getBody();
        assertThat(data.get("account").get("email").asText()).isEqualTo("aman@example.com");
        assertThat(data.get("account").get("name").asText()).isEqualTo("Aman");
        assertThat(data.get("settings").get("distanceUnit").asText()).isEqualTo("km");
        JsonNode exported = data.get("trips").get(0);
        assertThat(exported.get("name").asText()).isEqualTo("Saturday at Phoenix");
        assertThat(exported.get("yourRole").asText()).isEqualTo("member");
        assertThat(exported.get("friends").asText()).isEqualTo("Priya");
        assertThat(data.get("locationConsents")).hasSize(1);
        assertThat(data.get("chatMessages").get(0).get("text").asText()).isEqualTo("On my way");
        assertThat(data.get("alerts").get(0).get("kind").asText()).isEqualTo("trip_ended");
        assertThat(data.get("pushDevices").asInt()).isZero();
        // No coordinates anywhere: none are kept.
        assertThat(data.toString()).doesNotContain("\"lat\"").doesNotContain("\"lng\"");
    }

    @Test
    void exportIsForAccountsAndLimited() {
        assertThat(get("/api/v1/me/export", null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        for (int i = 0; i < 5; i++) {
            assertThat(get("/api/v1/me/export", priya).getStatusCode()).isEqualTo(HttpStatus.OK);
        }
        assertThat(get("/api/v1/me/export", priya).getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    // --- deleting the account

    @Test
    void aWrongPasswordDeletesNothing() {
        ResponseEntity<JsonNode> response = deleteAccount(priya, "not my password");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("errors").get(0).get("field").asText()).isEqualTo("password");
        assertThat(get("/api/v1/me", priya).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void deletingClosesTheAccountAtOnceAndStopsSharingEverywhere() {
        JsonNode hosted = createTrip(priya, "Priya's trip");
        String guest = join(null, hosted, true);
        JsonNode amans = createTrip(aman, "Aman's trip");
        join(priya, amans, true);
        jdbc.update("""
                INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
                SELECT gen_random_uuid(), id, 'https://fcm.googleapis.com/fcm/send/x', 'k', 'a', now()
                FROM users WHERE email = 'priya@example.com'
                """);

        ResponseEntity<JsonNode> response = deleteAccount(priya, PASSWORD);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        Instant removeAt = Instant.parse(response.getBody().get("removeAt").asText());
        assertThat(removeAt).isBetween(Instant.now().plusSeconds(29L * 86_400), Instant.now().plusSeconds(31L * 86_400));
        // Signed out: the token no longer works, and the session can't be renewed.
        assertThat(get("/api/v1/me", priya).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(refresh(priyasRefresh).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        // The trip she hosted ended for everyone; she left the one she was on.
        assertThat(get("/api/v1/trips/" + hosted.get("id").asText() + "/summary", guest).getBody()
                .get("status").asText()).isEqualTo("ended");
        JsonNode amansFriends = get("/api/v1/trips/" + amans.get("id").asText() + "/members", aman).getBody();
        assertThat(amansFriends).hasSize(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM push_subscriptions", Integer.class)).isZero();
        // The email says what happened and how to undo it.
        Mailpit.Email notice = mailpit.awaitOneTo("priya@example.com");
        assertThat(notice.subject()).isEqualTo("Your SquadMap account is closed");
        assertThat(notice.text()).contains("Log in before then");
        // The address can't be taken meanwhile.
        assertThat(post("/api/v1/auth/signup", Map.of("name", "Someone", "email", "priya@example.com",
                "password", PASSWORD, "acceptedTerms", true)).getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
    }

    @Test
    void loggingInAgainWithinTheGracePeriodKeepsTheAccount() {
        deleteAccount(priya, PASSWORD);

        ResponseEntity<JsonNode> login = login("priya@example.com", PASSWORD);

        assertThat(login.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(login.getBody().get("restored").asBoolean()).isTrue();
        String token = login.getBody().get("accessToken").asText();
        assertThat(get("/api/v1/me", token).getBody().get("name").asText()).isEqualTo("Priya");
        // Kept for good: the daily job leaves it alone, and the next login is an ordinary one.
        jdbc.update("UPDATE users SET updated_at = now() - interval '40 days' WHERE email = 'priya@example.com'");
        purge.purgeClosedAccounts();
        assertThat(login("priya@example.com", PASSWORD).getBody().get("restored").asBoolean()).isFalse();
    }

    @Test
    void aWrongPasswordDoesNotRestoreIt() {
        deleteAccount(priya, PASSWORD);

        assertThat(login("priya@example.com", "not my password").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(jdbc.queryForObject("SELECT deleted_at IS NOT NULL FROM users WHERE email = 'priya@example.com'",
                Boolean.class)).isTrue();
    }

    @Test
    void after30DaysTheDataIsRemovedButFriendsKeepTheirTrips() {
        JsonNode trip = createTrip(priya, "Saturday at Phoenix");
        join(aman, trip, true);
        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/end", priya, Map.of());
        deleteAccount(priya, PASSWORD);

        // Not yet.
        assertThat(purge.purgeClosedAccounts()).isZero();
        jdbc.update("UPDATE users SET deleted_at = now() - interval '31 days' WHERE email = 'priya@example.com'");
        assertThat(purge.purgeClosedAccounts()).isEqualTo(1);

        // Nothing left that identifies her.
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE email = 'priya@example.com'", Integer.class))
                .isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users WHERE name = 'Priya'", Integer.class)).isZero();
        assertThat(jdbc.queryForObject("SELECT count(*) FROM trip_members WHERE display_name = 'Priya'",
                Integer.class)).isZero();
        // Aman still has the trip, with her as a former member.
        JsonNode card = get("/api/v1/me/trips", aman).getBody().get("items").get(0);
        assertThat(card.get("name").asText()).isEqualTo("Saturday at Phoenix");
        assertThat(card.get("friends").get(0).asText()).isEqualTo("Former member");
        // She can no longer log in, and the address is free again.
        assertThat(login("priya@example.com", PASSWORD).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(post("/api/v1/auth/signup", Map.of("name", "Priya", "email", "priya@example.com",
                "password", PASSWORD, "acceptedTerms", true)).getStatusCode()).isEqualTo(HttpStatus.CREATED);
        // Running it again changes nothing.
        assertThat(purge.purgeClosedAccounts()).isZero();
    }

    @Test
    void deletingNeedsAnAccount() {
        String guest = join(null, createTrip(priya, "Dinner"), false);

        assertThat(deleteAccount(guest, PASSWORD).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(deleteAccount(null, PASSWORD).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // --- helpers

    private ResponseEntity<JsonNode> deleteAccount(String token, String password) {
        return send(HttpMethod.DELETE, "/api/v1/me", token, Map.of("password", password));
    }

    private ResponseEntity<JsonNode> login(String email, String password) {
        return post("/api/v1/auth/login", Map.of("email", email, "password", password));
    }

    private ResponseEntity<JsonNode> refresh(String cookie) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, cookie);
        headers.set(HttpHeaders.ORIGIN, ALLOWED_ORIGIN);
        return rest.exchange("/api/v1/auth/refresh", HttpMethod.POST, new HttpEntity<>(null, headers), JsonNode.class);
    }

    private JsonNode createTrip(String token, String name) {
        return send(HttpMethod.POST, "/api/v1/trips", token,
                Map.of("name", name, "shareHours", 2, "chatEnabled", true)).getBody();
    }

    /** Joins with an account, or as a guest when the token is null; returns the token to use. */
    private String join(String token, JsonNode trip, boolean share) {
        Map<String, Object> body = token == null
                ? Map.of("displayName", "Rohan", "shareLocation", share)
                : Map.of("shareLocation", share);
        JsonNode joined = send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), token, body).getBody();
        return token == null ? joined.get("accessToken").asText() : token;
    }

    private String signUp(String name, String email) {
        return post("/api/v1/auth/signup", Map.of("name", name, "email", email, "password", PASSWORD,
                "acceptedTerms", true)).getBody().get("accessToken").asText();
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
