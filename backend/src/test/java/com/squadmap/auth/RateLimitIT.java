package com.squadmap.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** Limits on the public account routes, shared through Redis. */
class RateLimitIT extends IntegrationTest {

    private static final String LOGIN = "/api/v1/auth/login";
    private static final String SIGNUP = "/api/v1/auth/signup";
    private static final String FORGOT = "/api/v1/auth/forgot";
    private static final String RESET = "/api/v1/auth/reset";
    private static final String REFRESH = "/api/v1/auth/refresh";

    @Autowired
    private StringRedisTemplate redisTemplate;

    private static Map<String, Object> login(String email) {
        return Map.of("email", email, "password", "not the password");
    }

    private static void assertLimited(ResponseEntity<JsonNode> response) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(response.getBody().get("code").asText()).isEqualTo("RATE_LIMITED");
        long retryAfter = Long.parseLong(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER));
        assertThat(retryAfter).isPositive();
        assertThat(response.getBody().get("retryAfter").asLong()).isEqualTo(retryAfter);
    }

    // --- log in ---

    @Test
    void loginAllowsFiveAttemptsAMinuteFromOneAddress() {
        for (int i = 0; i < 5; i++) {
            assertThat(postFrom("203.0.113.1", LOGIN, login("person" + i + "@example.com")).getStatusCode())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        ResponseEntity<JsonNode> sixth = postFrom("203.0.113.1", LOGIN, login("someone-else@example.com"));

        assertLimited(sixth);
        // Refills gradually: one attempt every 12 seconds.
        assertThat(Long.parseLong(sixth.getHeaders().getFirst(HttpHeaders.RETRY_AFTER))).isBetween(1L, 13L);
    }

    @Test
    void anotherAddressIsNotAffected() {
        for (int i = 0; i < 6; i++) {
            postFrom("203.0.113.1", LOGIN, login("person" + i + "@example.com"));
        }

        assertThat(postFrom("203.0.113.2", LOGIN, login("fresh@example.com")).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void loginAllowsFiveAttemptsAMinuteForOneAccountFromAnyAddress() {
        for (int i = 0; i < 5; i++) {
            postFrom("198.51.100." + i, LOGIN, login("priya@example.com"));
        }

        assertLimited(postFrom("198.51.100.99", LOGIN, login("PRIYA@example.com")));
    }

    @Test
    void theAccountLimitAppliesEvenWithTheRightPassword() {
        post(SIGNUP, Map.of("name", "Priya", "email", "priya@example.com",
                "password", "correct horse battery", "acceptedTerms", true));
        for (int i = 0; i < 5; i++) {
            postFrom("198.51.100." + i, LOGIN, login("priya@example.com"));
        }

        assertLimited(postFrom("198.51.100.99", LOGIN,
                Map.of("email", "priya@example.com", "password", "correct horse battery")));
    }

    @Test
    void invalidRequestsDoNotUseUpTheLimit() {
        for (int i = 0; i < 10; i++) {
            assertThat(postFrom("203.0.113.1", LOGIN, Map.of("email", "")).getStatusCode())
                    .isEqualTo(HttpStatus.BAD_REQUEST);
        }

        assertThat(postFrom("203.0.113.1", LOGIN, login("priya@example.com")).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // --- forgot password ---

    @Test
    void forgotAllowsThreeEmailsAnHourPerAddressAndSendsNoMore() {
        post(SIGNUP, Map.of("name", "Priya", "email", "priya@example.com",
                "password", "correct horse battery", "acceptedTerms", true));
        for (int i = 0; i < 3; i++) {
            assertThat(postFrom("198.51.100." + i, FORGOT, Map.of("email", "priya@example.com")).getStatusCode())
                    .isEqualTo(HttpStatus.ACCEPTED);
        }

        assertLimited(postFrom("198.51.100.99", FORGOT, Map.of("email", "priya@example.com")));
        assertThat(mailpit.settledMessagesTo("priya@example.com")).hasSize(3);
    }

    @Test
    void forgotIsLimitedTheSameWayForAnAddressWithNoAccount() {
        for (int i = 0; i < 3; i++) {
            postFrom("198.51.100." + i, FORGOT, Map.of("email", "nobody@example.com"));
        }

        assertLimited(postFrom("198.51.100.99", FORGOT, Map.of("email", "nobody@example.com")));
    }

    @Test
    void forgotAllowsTenRequestsAnHourFromOneAddress() {
        for (int i = 0; i < 10; i++) {
            postFrom("203.0.113.1", FORGOT, Map.of("email", "person" + i + "@example.com"));
        }

        assertLimited(postFrom("203.0.113.1", FORGOT, Map.of("email", "another@example.com")));
    }

    // --- sign up, reset, refresh ---

    @Test
    void signupAllowsTenAccountsAnHourFromOneAddress() {
        for (int i = 0; i < 10; i++) {
            assertThat(postFrom("203.0.113.1", SIGNUP, Map.of("name", "Person", "email", "p" + i + "@example.com",
                    "password", "correct horse battery", "acceptedTerms", true)).getStatusCode())
                    .isEqualTo(HttpStatus.CREATED);
        }

        assertLimited(postFrom("203.0.113.1", SIGNUP, Map.of("name", "Person", "email", "p10@example.com",
                "password", "correct horse battery", "acceptedTerms", true)));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(10);
    }

    @Test
    void resetAllowsTenAttemptsAnHourFromOneAddress() {
        Map<String, String> guess = Map.of("token", "guessed-token-guessed-token-guessed-token-0",
                "password", "a brand new passphrase");
        for (int i = 0; i < 10; i++) {
            assertThat(postFrom("203.0.113.1", RESET, guess).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        }

        assertLimited(postFrom("203.0.113.1", RESET, guess));
    }

    @Test
    void refreshAllowsSixtyCallsAMinuteFromOneAddress() {
        HttpHeaders headers = new HttpHeaders();
        headers.set("X-Forwarded-For", "203.0.113.1");
        HttpEntity<Void> request = new HttpEntity<>(headers);
        for (int i = 0; i < 60; i++) {
            assertThat(rest.exchange(REFRESH, HttpMethod.POST, request, JsonNode.class).getStatusCode())
                    .isEqualTo(HttpStatus.UNAUTHORIZED);
        }

        assertLimited(rest.exchange(REFRESH, HttpMethod.POST, request, JsonNode.class));
    }

    // --- privacy ---

    @Test
    void redisNeverHoldsAnEmailOrAnIpAddress() {
        postFrom("203.0.113.77", LOGIN, login("priya@example.com"));
        postFrom("203.0.113.77", FORGOT, Map.of("email", "priya@example.com"));

        Set<String> keys = redisTemplate.keys("*");

        assertThat(keys).isNotEmpty().allMatch(key -> key.startsWith("rl:"));
        assertThat(keys).noneMatch(key -> key.contains("priya") || key.contains("203.0.113"));
    }
}
