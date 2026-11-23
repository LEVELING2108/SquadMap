package com.squadmap.common;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.autoconfigure.actuate.observability.AutoConfigureObservability;
import org.springframework.boot.test.web.server.LocalManagementPort;
import org.springframework.test.context.TestPropertySource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.time.Instant;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The app's own numbers reach Prometheus, and say nothing about who or where. Spring Boot leaves the
 * Prometheus endpoint off in tests unless asked, hence the annotation (and its own application context).
 */
@AutoConfigureObservability
@TestPropertySource(properties = "management.server.port=0")
class MetricsIT extends IntegrationTest {

    @LocalManagementPort
    private int managementPort;

    @Test
    void tripsLocationsAndRoutesAreCounted() throws Exception {
        double before = value(scrape(), "squadmap_location_updates_total");
        String host = post("/api/v1/auth/signup", Map.of("name", "Priya", "email", "priya@example.com",
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
        JsonNode trip = send(HttpMethod.POST, "/api/v1/trips", host, Map.of("name", "Dinner", "shareHours", 2,
                "chatEnabled", false, "destination", Map.of("name", "Phoenix Marketcity", "lat", 18.5622,
                        "lng", 73.9167, "fromSearch", false))).getBody();
        String guest = send(HttpMethod.POST, "/api/v1/join/" + trip.get("code").asText(), null,
                Map.of("displayName", "Aman", "shareLocation", true)).getBody().get("accessToken").asText();

        send(HttpMethod.POST, "/api/v1/trips/" + trip.get("id").asText() + "/locations", guest,
                Map.of("lat", 18.58, "lng", 73.90, "acc", 8, "ts", Instant.now().toString()));
        Thread.sleep(800);

        String metrics = scrape();
        assertThat(value(metrics, "squadmap_location_updates_total")).isEqualTo(before + 1);
        assertThat(value(metrics, "squadmap_trips_active")).isGreaterThanOrEqualTo(1);
        assertThat(metrics).containsPattern("squadmap_eta_routes_total\\{[^}]*source=\"(mapbox|cache|estimate)\"");
        assertThat(metrics).contains("squadmap_live_connections");
        // Counts only: no trip, person or place in any metric.
        assertThat(metrics).doesNotContain(trip.get("id").asText()).doesNotContain("18.58").doesNotContain("Aman");
    }

    @Test
    void prometheusNeedsNoTokenOnTheManagementPortButIsGoneFromThePublicOne() {
        assertThat(rest.getForEntity(management("/actuator/prometheus"), String.class).getStatusCode())
                .isEqualTo(HttpStatus.OK);
        assertThat(rest.getForEntity(management("/actuator/env"), String.class).getStatusCode().value())
                .isIn(401, 404);
        // The public port doesn't serve it at all.
        assertThat(rest.getForEntity("/actuator/prometheus", String.class).getStatusCode().value()).isIn(401, 404);
    }

    private String scrape() {
        return rest.getForEntity(management("/actuator/prometheus"), String.class).getBody();
    }

    private String management(String path) {
        return "http://localhost:" + managementPort + path;
    }

    private static double value(String metrics, String name) {
        Matcher match = Pattern.compile("(?m)^" + name + "(\\{[^}]*})? ([0-9.eE+-]+)$").matcher(metrics);
        return match.find() ? Double.parseDouble(match.group(2)) : 0;
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
