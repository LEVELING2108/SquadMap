package com.squadmap.common.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.web.ServerProperties;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

import static org.assertj.core.api.Assertions.assertThat;

/** Where a request comes from can't be faked to dodge rate limits, and API answers carry strict headers. */
class ClientAddressAndHeadersIT extends IntegrationTest {

    @Autowired
    private ServerProperties server;

    @Test
    void onlyProxiesOnThisMachineOrAPrivateNetworkAreBelieved() {
        Pattern trusted = Pattern.compile(server.getTomcat().getRemoteip().getInternalProxies());

        // Nginx on the same machine, or a container network.
        assertThat(trusted.matcher("127.0.0.1").matches()).isTrue();
        assertThat(trusted.matcher("10.0.0.5").matches()).isTrue();
        assertThat(trusted.matcher("172.18.0.3").matches()).isTrue();
        assertThat(trusted.matcher("192.168.1.20").matches()).isTrue();
        // Anyone on the internet: their X-Forwarded-For is ignored.
        assertThat(trusted.matcher("203.0.113.9").matches()).isFalse();
        assertThat(trusted.matcher("8.8.8.8").matches()).isFalse();
    }

    @Test
    void anAddressSentAheadOfTheProxysOwnIsIgnored() {
        // A client sends a new made-up address each time; the proxy adds the real one after it.
        for (int i = 0; i < 5; i++) {
            assertThat(loginFrom(UUID.randomUUID().toString().substring(0, 4) + ".9.9.9, 198.51.100.7").getStatusCode())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        // Still the same real client, so the limit holds.
        assertThat(loginFrom("1.2.3.4, 198.51.100.7").getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        // Someone else (another address, another account) is unaffected.
        assertThat(loginFrom("198.51.100.8", "someone@example.com").getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void apiAnswersCanRunNothingAndLeakNothing() {
        ResponseEntity<JsonNode> response = get("/api/v1/me", null);
        HttpHeaders headers = response.getHeaders();

        assertThat(headers.getFirst("Content-Security-Policy"))
                .isEqualTo("default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
        assertThat(headers.getFirst("Permissions-Policy")).contains("geolocation=()");
        assertThat(headers.getFirst("Referrer-Policy")).isEqualTo("no-referrer");
        assertThat(headers.getFirst("X-Content-Type-Options")).isEqualTo("nosniff");
        assertThat(headers.getFirst("X-Frame-Options")).isEqualTo("DENY");
        assertThat(headers.getFirst("Cross-Origin-Resource-Policy")).isEqualTo("same-site");
        assertThat(headers.getCacheControl()).contains("no-store");
    }

    @Test
    void successfulAnswersCarryThemToo() {
        ResponseEntity<JsonNode> response = post("/api/v1/auth/signup", Map.of("name", "Priya",
                "email", "priya@example.com", "password", "correct horse battery", "acceptedTerms", true));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        assertThat(response.getHeaders().getFirst("Content-Security-Policy")).startsWith("default-src 'none'");
    }

    private ResponseEntity<JsonNode> loginFrom(String forwardedFor) {
        return loginFrom(forwardedFor, "nobody@example.com");
    }

    private ResponseEntity<JsonNode> loginFrom(String forwardedFor, String email) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("X-Forwarded-For", forwardedFor);
        return rest.exchange("/api/v1/auth/login", HttpMethod.POST, new HttpEntity<>(
                Map.of("email", email, "password", "wrong password"), headers), JsonNode.class);
    }
}
