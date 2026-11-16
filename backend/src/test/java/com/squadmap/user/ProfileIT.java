package com.squadmap.user;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;

class ProfileIT extends IntegrationTest {

    private static final String SETTINGS = "/api/v1/me/settings";
    private static final String STATS = "/api/v1/me/stats";

    private String priya;

    @BeforeEach
    void signUp() {
        priya = signUpAs("Priya", "priya@example.com");
    }

    private String signUpAs(String name, String email) {
        return post("/api/v1/auth/signup", Map.of("name", name, "email", email,
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
    }

    private ResponseEntity<JsonNode> send(HttpMethod method, String path, String token, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }

    private JsonNode createTrip(String token) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "Trip");
        body.put("shareHours", 2);
        body.put("chatEnabled", true);
        return send(HttpMethod.POST, "/api/v1/trips", token, body).getBody();
    }

    private void join(String token, JsonNode trip) {
        send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), token, Map.of("shareLocation", false));
    }

    private void joinAsGuest(String name, JsonNode trip) {
        send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), null,
                Map.of("displayName", name, "shareLocation", false));
    }

    private void end(String token, JsonNode trip) {
        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/end", token, null);
    }

    // --- settings ---

    @Test
    void settingsStartAtTheirDefaults() {
        JsonNode settings = get(SETTINGS, priya).getBody();

        assertThat(settings.get("darkMap").asBoolean()).isFalse();
        assertThat(settings.get("distanceUnit").asText()).isEqualTo("km");
        assertThat(settings.get("defaultShareHours").asInt()).isEqualTo(4);
    }

    @Test
    void changingOneSettingKeepsTheOthers() {
        send(HttpMethod.PATCH, SETTINGS, priya, Map.of("darkMap", true, "defaultShareHours", 2));

        ResponseEntity<JsonNode> response = send(HttpMethod.PATCH, SETTINGS, priya, Map.of("distanceUnit", "mi"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("darkMap").asBoolean()).isTrue();
        assertThat(response.getBody().get("distanceUnit").asText()).isEqualTo("mi");
        assertThat(response.getBody().get("defaultShareHours").asInt()).isEqualTo(2);
        assertThat(get(SETTINGS, priya).getBody()).isEqualTo(response.getBody());
    }

    @Test
    void changesSentAtTheSameTimeAreAllKept() throws Exception {
        List<Map<String, Object>> changes = List.of(
                Map.of("darkMap", true), Map.of("distanceUnit", "mi"), Map.of("defaultShareHours", 8));
        try (ExecutorService pool = Executors.newFixedThreadPool(changes.size())) {
            CountDownLatch start = new CountDownLatch(1);
            List<Future<ResponseEntity<JsonNode>>> sent = new ArrayList<>();
            for (Map<String, Object> change : changes) {
                sent.add(pool.submit(() -> {
                    start.await();
                    return send(HttpMethod.PATCH, SETTINGS, priya, change);
                }));
            }
            start.countDown();
            for (Future<ResponseEntity<JsonNode>> response : sent) {
                assertThat(response.get().getStatusCode()).isEqualTo(HttpStatus.OK);
            }
        }

        JsonNode settings = get(SETTINGS, priya).getBody();
        assertThat(settings.get("darkMap").asBoolean()).isTrue();
        assertThat(settings.get("distanceUnit").asText()).isEqualTo("mi");
        assertThat(settings.get("defaultShareHours").asInt()).isEqualTo(8);
    }

    @Test
    void settingsBelongToTheirAccount() {
        String aman = signUpAs("Aman", "aman@example.com");
        send(HttpMethod.PATCH, SETTINGS, priya, Map.of("darkMap", true));

        assertThat(get(SETTINGS, aman).getBody().get("darkMap").asBoolean()).isFalse();
    }

    @Test
    void invalidSettingsAreRefusedAndChangeNothing() {
        ResponseEntity<JsonNode> hours = send(HttpMethod.PATCH, SETTINGS, priya,
                Map.of("defaultShareHours", 3, "darkMap", true));
        ResponseEntity<JsonNode> unit = send(HttpMethod.PATCH, SETTINGS, priya, Map.of("distanceUnit", "furlongs"));
        ResponseEntity<JsonNode> unknown = send(HttpMethod.PATCH, SETTINGS, priya, Map.of("showSpeed", true));

        assertThat(hours.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(hours.getBody().get("errors").get(0).get("field").asText()).isEqualTo("defaultShareHours");
        assertThat(unit.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(unit.getBody().get("errors").get(0).get("field").asText()).isEqualTo("distanceUnit");
        assertThat(unknown.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get(SETTINGS, priya).getBody().get("darkMap").asBoolean()).isFalse();
    }

    @Test
    void storedValuesThisVersionDoesNotKnowAreKeptAndReadAsDefaults() {
        jdbc.update("UPDATE users SET settings = '{\"darkMap\": \"yes\", \"distanceUnit\": \"furlongs\", "
                + "\"defaultShareHours\": 3, \"futureSetting\": 7}'::jsonb WHERE email = 'priya@example.com'");

        JsonNode settings = get(SETTINGS, priya).getBody();
        send(HttpMethod.PATCH, SETTINGS, priya, Map.of("darkMap", true));

        assertThat(settings.get("darkMap").asBoolean()).isFalse();
        assertThat(settings.get("distanceUnit").asText()).isEqualTo("km");
        assertThat(settings.get("defaultShareHours").asInt()).isEqualTo(4);
        assertThat(jdbc.queryForObject("SELECT settings->>'futureSetting' FROM users WHERE email = 'priya@example.com'",
                String.class)).isEqualTo("7");
    }

    // --- stats ---

    @Test
    void statsCountTripsAndDifferentPeople() {
        String aman = signUpAs("Aman", "aman@example.com");
        String rohan = signUpAs("Rohan", "rohan@example.com");

        JsonNode first = createTrip(priya);
        join(aman, first);
        joinAsGuest("Sourav", first);
        send(HttpMethod.DELETE, "/api/v1/trips/" + first.get("id").asText() + "/members/me", aman, null);
        end(priya, first);

        // Aman again (counted once), a guest with the same name in another case (once), and Rohan.
        JsonNode second = createTrip(priya);
        join(aman, second);
        joinAsGuest("sourav", second);
        join(rohan, second);

        // A trip Priya joined rather than hosted.
        JsonNode third = createTrip(aman);
        join(priya, third);

        JsonNode stats = get(STATS, priya).getBody();

        assertThat(stats.get("trips").asLong()).isEqualTo(3);
        assertThat(stats.get("friends").asLong()).isEqualTo(3);
    }

    @Test
    void statsAreZeroForSomeoneNew() {
        JsonNode stats = get(STATS, priya).getBody();

        assertThat(stats.get("trips").asLong()).isZero();
        assertThat(stats.get("friends").asLong()).isZero();
    }

    @Test
    void settingsAndStatsNeedAnAccount() {
        JsonNode trip = createTrip(priya);
        String guest = send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), null,
                Map.of("displayName", "Sourav", "shareLocation", false)).getBody().get("accessToken").asText();

        assertThat(get(SETTINGS, null).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(get(SETTINGS, guest).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(get(STATS, guest).getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(send(HttpMethod.PATCH, SETTINGS, guest, Map.of("darkMap", true)).getStatusCode())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }
}
