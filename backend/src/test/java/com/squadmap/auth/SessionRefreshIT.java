package com.squadmap.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import com.squadmap.auth.service.RefreshTokenService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Sessions: a long-lived refresh cookie that is replaced on every use. Presenting a cookie
 * that was already replaced means it was copied, so the whole session is ended.
 */
class SessionRefreshIT extends IntegrationTest {

    private static final String SIGNUP = "/api/v1/auth/signup";
    private static final String LOGIN = "/api/v1/auth/login";
    private static final String REFRESH = "/api/v1/auth/refresh";
    private static final String LOGOUT = "/api/v1/auth/logout";
    private static final String COOKIE = "sm_refresh";
    private static final String PASSWORD = "correct horse battery";

    @Autowired
    private RefreshTokenService refreshTokens;

    private String firstCookie;

    @BeforeEach
    void signUp() {
        ResponseEntity<JsonNode> response = post(SIGNUP, Map.of(
                "name", "Priya", "email", "priya@example.com", "password", PASSWORD, "acceptedTerms", true));
        firstCookie = refreshCookie(response).getValue();
    }

    // --- helpers ---

    private static ResponseCookie refreshCookie(ResponseEntity<?> response) {
        List<String> setCookies = response.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE);
        return setCookies.stream()
                .filter(header -> header.startsWith(COOKIE + "="))
                .map(SessionRefreshIT::parse)
                .findFirst()
                .orElseThrow(() -> new AssertionError("No " + COOKIE + " cookie in " + setCookies));
    }

    /** Parses a Set-Cookie header into its name, value and attributes. */
    private static ResponseCookie parse(String header) {
        String[] parts = header.split(";\\s*");
        String[] nameValue = parts[0].split("=", 2);
        ResponseCookie.ResponseCookieBuilder cookie = ResponseCookie.from(nameValue[0], nameValue[1]);
        for (int i = 1; i < parts.length; i++) {
            String[] attribute = parts[i].split("=", 2);
            switch (attribute[0].toLowerCase()) {
                case "path" -> cookie.path(attribute[1]);
                case "max-age" -> cookie.maxAge(Long.parseLong(attribute[1]));
                case "httponly" -> cookie.httpOnly(true);
                case "secure" -> cookie.secure(true);
                case "samesite" -> cookie.sameSite(attribute[1]);
                default -> { }
            }
        }
        return cookie.build();
    }

    private ResponseEntity<JsonNode> withCookie(String path, String cookieValue) {
        HttpHeaders headers = new HttpHeaders();
        if (cookieValue != null) {
            headers.add(HttpHeaders.COOKIE, COOKIE + "=" + cookieValue);
        }
        return rest.exchange(path, HttpMethod.POST, new HttpEntity<>(headers), JsonNode.class);
    }

    private void assertSessionEnded(ResponseEntity<JsonNode> response) {
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().get("code").asText()).isEqualTo("SESSION_EXPIRED");
        assertThat(refreshCookie(response).getMaxAge()).isEqualTo(Duration.ZERO);
    }

    // --- the cookie itself ---

    @Test
    void signupAndLoginSetAProtectedLongLivedCookieScopedToTheAuthRoutes() {
        ResponseEntity<JsonNode> login = post(LOGIN, Map.of("email", "priya@example.com", "password", PASSWORD));

        ResponseCookie cookie = refreshCookie(login);
        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.isSecure()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("Lax");
        assertThat(cookie.getPath()).isEqualTo("/api/v1/auth");
        assertThat(cookie.getMaxAge()).isEqualTo(Duration.ofDays(30));
        assertThat(cookie.getValue()).hasSizeGreaterThanOrEqualTo(43);
    }

    @Test
    void eachSignInStartsItsOwnSession() {
        String second = refreshCookie(post(LOGIN, Map.of("email", "priya@example.com", "password", PASSWORD)))
                .getValue();

        assertThat(second).isNotEqualTo(firstCookie);
        assertThat(jdbc.queryForObject("SELECT count(DISTINCT family_id) FROM refresh_tokens", Integer.class))
                .isEqualTo(2);
    }

    @Test
    void onlyAHashOfTheCookieIsStored() {
        List<String> stored = jdbc.queryForList("SELECT token_hash FROM refresh_tokens", String.class);

        assertThat(stored).hasSize(1);
        assertThat(stored.get(0)).isNotEqualTo(firstCookie).hasSize(64);
    }

    // --- refreshing ---

    @Test
    void refreshReturnsANewAccessTokenAndReplacesTheCookie() {
        ResponseEntity<JsonNode> response = withCookie(REFRESH, firstCookie);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("accessToken").asText()).isNotBlank();
        assertThat(response.getBody().get("user").get("email").asText()).isEqualTo("priya@example.com");
        String next = refreshCookie(response).getValue();
        assertThat(next).isNotEqualTo(firstCookie);

        ResponseEntity<JsonNode> me = get("/api/v1/me", response.getBody().get("accessToken").asText());
        assertThat(me.getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void theReplacementCookieKeepsWorking() {
        String second = refreshCookie(withCookie(REFRESH, firstCookie)).getValue();
        String third = refreshCookie(withCookie(REFRESH, second)).getValue();

        assertThat(withCookie(REFRESH, third).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void refreshWithoutACookieIsRejected() {
        assertSessionEnded(withCookie(REFRESH, null));
    }

    @Test
    void refreshWithAnUnknownCookieIsRejected() {
        assertSessionEnded(withCookie(REFRESH, "made-up-value-that-was-never-issued-0000000"));
    }

    @Test
    void refreshWithAnExpiredCookieIsRejected() {
        jdbc.update("UPDATE refresh_tokens SET expires_at = now() - interval '1 second'");

        assertSessionEnded(withCookie(REFRESH, firstCookie));
    }

    @Test
    void refreshIsRejectedOnceTheAccountIsPendingDeletion() {
        jdbc.update("UPDATE users SET deleted_at = now()");

        assertSessionEnded(withCookie(REFRESH, firstCookie));
    }

    // --- reuse detection ---

    @Test
    void reusingAReplacedCookieEndsTheWholeSession() {
        String second = refreshCookie(withCookie(REFRESH, firstCookie)).getValue();

        // Someone presents the old cookie again: it was copied.
        assertSessionEnded(withCookie(REFRESH, firstCookie));

        // The legitimate holder's newer cookie no longer works either.
        assertSessionEnded(withCookie(REFRESH, second));
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM refresh_tokens WHERE revoked_at IS NULL", Integer.class)).isZero();
    }

    @Test
    void reuseInOneSessionDoesNotEndTheAccountsOtherSessions() {
        String otherDevice = refreshCookie(post(LOGIN, Map.of("email", "priya@example.com", "password", PASSWORD)))
                .getValue();
        withCookie(REFRESH, firstCookie);

        assertSessionEnded(withCookie(REFRESH, firstCookie));

        assertThat(withCookie(REFRESH, otherDevice).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void twoSimultaneousRefreshesWithTheSameCookieNeverBothSucceed() throws Exception {
        java.util.concurrent.ExecutorService pool = java.util.concurrent.Executors.newFixedThreadPool(2);
        java.util.concurrent.CountDownLatch start = new java.util.concurrent.CountDownLatch(1);
        java.util.concurrent.Callable<HttpStatus> refresh = () -> {
            start.await();
            return HttpStatus.valueOf(withCookie(REFRESH, firstCookie).getStatusCode().value());
        };
        try {
            java.util.concurrent.Future<HttpStatus> a = pool.submit(refresh);
            java.util.concurrent.Future<HttpStatus> b = pool.submit(refresh);
            start.countDown();

            List<HttpStatus> results = List.of(a.get(), b.get());

            assertThat(results).containsOnly(HttpStatus.OK, HttpStatus.UNAUTHORIZED);
            assertThat(results).filteredOn(HttpStatus.OK::equals).hasSizeLessThanOrEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    // --- log out ---

    @Test
    void logoutEndsTheSessionAndClearsTheCookie() {
        String second = refreshCookie(withCookie(REFRESH, firstCookie)).getValue();

        ResponseEntity<JsonNode> response = withCookie(LOGOUT, second);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(refreshCookie(response).getMaxAge()).isEqualTo(Duration.ZERO);
        assertSessionEnded(withCookie(REFRESH, second));
    }

    @Test
    void logoutOnlyEndsThatSession() {
        String otherDevice = refreshCookie(post(LOGIN, Map.of("email", "priya@example.com", "password", PASSWORD)))
                .getValue();

        withCookie(LOGOUT, firstCookie);

        assertThat(withCookie(REFRESH, otherDevice).getStatusCode()).isEqualTo(HttpStatus.OK);
    }

    @Test
    void logoutWithoutAValidCookieStillSucceedsAndClearsIt() {
        ResponseEntity<JsonNode> missing = withCookie(LOGOUT, null);
        ResponseEntity<JsonNode> unknown = withCookie(LOGOUT, "made-up-value-that-was-never-issued-0000000");

        assertThat(missing.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(unknown.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(refreshCookie(unknown).getMaxAge()).isEqualTo(Duration.ZERO);
    }

    // --- housekeeping ---

    @Test
    void purgeRemovesTokensLongExpiredAndKeepsCurrentOnes() {
        post(LOGIN, Map.of("email", "priya@example.com", "password", PASSWORD));
        jdbc.update("UPDATE refresh_tokens SET expires_at = now() - interval '2 days' "
                + "WHERE token_hash = (SELECT min(token_hash) FROM refresh_tokens)");

        int removed = refreshTokens.purgeExpired();

        assertThat(removed).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM refresh_tokens", Integer.class)).isEqualTo(1);
    }
}
