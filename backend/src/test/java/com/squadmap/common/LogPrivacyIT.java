package com.squadmap.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Runs a whole trip (sign up, log in, start, join, share, chat, a refused reading, end) and checks that the
 * logs, which also feed error reports, never hold a place, a token, a password, a trip code, an email or a
 * chat message.
 */
@ExtendWith(OutputCaptureExtension.class)
class LogPrivacyIT extends IntegrationTest {

    private static final String PASSWORD = "Correct-horse-battery-41";
    private static final double LAT = 18.561234;
    private static final double LNG = 73.912345;
    private static final String MESSAGE = "Meet at gate 7 near the blue kiosk";

    @Test
    void aWholeTripLeavesNothingPrivateInTheLogs(CapturedOutput output) throws Exception {
        String email = "log-check-" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        ResponseEntity<JsonNode> signedUp = post("/api/v1/auth/signup", Map.of("name", "Priya", "email", email,
                "password", PASSWORD, "acceptedTerms", true));
        String host = signedUp.getBody().get("accessToken").asText();
        String refresh = signedUp.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE).stream()
                .filter(cookie -> cookie.startsWith("sm_refresh=")).findFirst().orElseThrow()
                .substring("sm_refresh=".length()).split(";")[0];
        post("/api/v1/auth/login", Map.of("email", email, "password", PASSWORD));
        post("/api/v1/auth/login", Map.of("email", email, "password", "wrong-" + PASSWORD));

        JsonNode trip = send(HttpMethod.POST, "/api/v1/trips", host, Map.of("name", "Saturday at Phoenix",
                "shareHours", 2, "chatEnabled", true)).getBody();
        String tripId = trip.get("id").asText();
        String code = trip.get("code").asText();
        JsonNode joined = send(HttpMethod.POST, "/api/v1/join/" + code, null,
                Map.of("displayName", "Aman", "shareLocation", true)).getBody();
        String guest = joined.get("accessToken").asText();

        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/locations", guest, reading(LAT, LNG, 8));
        // One the server refuses (too rough), which is logged as a refusal.
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/locations", guest, reading(LAT + 0.001, LNG, 900));
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/messages", guest,
                Map.of("text", MESSAGE, "clientId", UUID.randomUUID().toString()));
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, Map.of());
        Thread.sleep(500);

        String logs = output.getAll();
        assertThat(logs).as("something was logged at all").isNotBlank();
        for (String secret : List.of(host, guest, refresh, PASSWORD, code, email, MESSAGE)) {
            assertThat(logs).as("no tokens, passwords, codes, emails or messages").doesNotContain(secret);
        }
        for (String place : List.of("18.561234", "73.912345", "18.562234", "18.56123", "73.91234")) {
            assertThat(logs).as("no coordinates").doesNotContain(place);
        }
    }

    private static Map<String, Object> reading(double lat, double lng, double acc) {
        Map<String, Object> reading = new HashMap<>();
        reading.put("lat", lat);
        reading.put("lng", lng);
        reading.put("acc", acc);
        reading.put("ts", Instant.now().toString());
        return reading;
    }

    private ResponseEntity<JsonNode> send(HttpMethod method, String path, String token, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            headers.setBearerAuth(token);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }
}
