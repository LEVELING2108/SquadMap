package com.squadmap.invite;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;

import java.time.Duration;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** A guest stays on their trip across reloads through an HttpOnly cookie. */
class GuestSessionIT extends IntegrationTest {

    private static final String SESSION = "/api/v1/guest/session";

    private String host;
    private String tripId;
    private String code;

    @BeforeEach
    void startATrip() {
        host = post("/api/v1/auth/signup", Map.of("name", "Priya", "email", "priya@example.com",
                "password", "correct horse battery", "acceptedTerms", true)).getBody().get("accessToken").asText();
        JsonNode trip = send(HttpMethod.POST, "/api/v1/trips", host, null,
                Map.of("name", "Saturday at Phoenix", "shareHours", 2, "chatEnabled", true)).getBody();
        tripId = trip.get("id").asText();
        code = trip.get("code").asText();
    }

    private ResponseEntity<JsonNode> send(HttpMethod method, String path, String token, String cookie, Object body) {
        HttpHeaders headers = new HttpHeaders();
        if (body != null) {
            headers.setContentType(MediaType.APPLICATION_JSON);
        }
        if (token != null) {
            headers.setBearerAuth(token);
        }
        if (cookie != null) {
            headers.add(HttpHeaders.COOKIE, "sm_guest=" + cookie);
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }

    private static ResponseCookie guestCookie(ResponseEntity<?> response) {
        String header = response.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE).stream()
                .filter(value -> value.startsWith("sm_guest="))
                .findFirst()
                .orElseThrow(() -> new AssertionError("No sm_guest cookie"));
        String[] parts = header.split(";\\s*");
        ResponseCookie.ResponseCookieBuilder cookie = ResponseCookie.from("sm_guest", parts[0].substring(9));
        for (int i = 1; i < parts.length; i++) {
            String[] attribute = parts[i].split("=", 2);
            switch (attribute[0].toLowerCase()) {
                case "path" -> cookie.path(attribute[1]);
                case "max-age" -> cookie.maxAge(Long.parseLong(attribute[1]));
                case "httponly" -> cookie.httpOnly(true);
                case "samesite" -> cookie.sameSite(attribute[1]);
                default -> { }
            }
        }
        return cookie.build();
    }

    private ResponseEntity<JsonNode> joinAsGuest() {
        return send(HttpMethod.POST, "/api/v1/join/" + code, null, null,
                Map.of("displayName", "Aman", "shareLocation", true));
    }

    @Test
    void joiningAsAGuestSetsAProtectedCookieThatLastsUntilTheTripEnds() {
        ResponseCookie cookie = guestCookie(joinAsGuest());

        assertThat(cookie.isHttpOnly()).isTrue();
        assertThat(cookie.getSameSite()).isEqualTo("Lax");
        assertThat(cookie.getPath()).isEqualTo("/api/v1/guest");
        assertThat(cookie.getMaxAge()).isBetween(Duration.ofMinutes(119), Duration.ofMinutes(120));
    }

    @Test
    void joiningWithAnAccountSetsNoGuestCookie() {
        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/join/" + code,
                post("/api/v1/auth/signup", Map.of("name", "Aman", "email", "aman@example.com",
                        "password", "correct horse battery", "acceptedTerms", true))
                        .getBody().get("accessToken").asText(),
                null, Map.of("shareLocation", true));

        assertThat(response.getHeaders().getOrEmpty(HttpHeaders.SET_COOKIE))
                .noneMatch(value -> value.startsWith("sm_guest="));
    }

    @Test
    void aReloadPicksTheGuestBackUpWithAFreshPass() {
        ResponseEntity<JsonNode> join = joinAsGuest();
        JsonNode joined = join.getBody();
        String cookie = guestCookie(join).getValue();
        assertThat(cookie).isEqualTo(joined.get("accessToken").asText());

        ResponseEntity<JsonNode> restored = send(HttpMethod.POST, SESSION, null, cookie, null);

        assertThat(restored.getStatusCode()).isEqualTo(HttpStatus.OK);
        JsonNode body = restored.getBody();
        assertThat(body.get("memberId").asText()).isEqualTo(joined.get("memberId").asText());
        assertThat(body.get("displayName").asText()).isEqualTo("Aman");
        assertThat(body.get("sharingLocation").asBoolean()).isTrue();
        assertThat(send(HttpMethod.GET, "/api/v1/trips/" + tripId, body.get("accessToken").asText(), null, null)
                .getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(guestCookie(restored).getValue()).isEqualTo(body.get("accessToken").asText());
    }

    @Test
    void afterAnExtensionTheRestoredPassCoversTheExtraTime() {
        JsonNode joined = joinAsGuest().getBody();
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/extend", host, null, Map.of("minutes", 60));

        ResponseEntity<JsonNode> restored = send(HttpMethod.POST, SESSION, null,
                joined.get("accessToken").asText(), null);

        assertThat(restored.getBody().get("expiresIn").asLong() - joined.get("expiresIn").asLong())
                .isBetween(3_590L, 3_610L);
        assertThat(guestCookie(restored).getMaxAge()).isGreaterThan(Duration.ofMinutes(170));
    }

    @Test
    void noCookieGarbageOrAnAccountTokenIsRefusedAndTheCookieCleared() {
        String accountToken = host;
        for (String cookie : new String[] {null, "not-a-pass", accountToken}) {
            ResponseEntity<JsonNode> response = send(HttpMethod.POST, SESSION, null, cookie, null);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody().get("code").asText()).isEqualTo("GUEST_SESSION_ENDED");
            assertThat(guestCookie(response).getMaxAge()).isEqualTo(Duration.ZERO);
        }
    }

    @Test
    void aGuestWhoLeftCannotBePickedBackUp() {
        String pass = joinAsGuest().getBody().get("accessToken").asText();
        send(HttpMethod.DELETE, "/api/v1/trips/" + tripId + "/members/me", pass, null, null);

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, SESSION, null, pass, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().get("code").asText()).isEqualTo("GUEST_SESSION_ENDED");
    }

    @Test
    void anEndedTripCannotBePickedBackUp() {
        String pass = joinAsGuest().getBody().get("accessToken").asText();
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null, null);

        assertThat(send(HttpMethod.POST, SESSION, null, pass, null).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void everyFailureAnswersTheSameWay() {
        String pass = joinAsGuest().getBody().get("accessToken").asText();
        send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/end", host, null, null);

        JsonNode ended = send(HttpMethod.POST, SESSION, null, pass, null).getBody();
        JsonNode garbage = send(HttpMethod.POST, SESSION, null, "not-a-pass", null).getBody();

        assertThat(ended.get("detail")).isEqualTo(garbage.get("detail"));
    }

    @Test
    void logoutClearsTheCookie() {
        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/guest/logout", null, "anything", null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(guestCookie(response).getMaxAge()).isEqualTo(Duration.ZERO);
    }

    @Test
    void renewingThePassAlsoRefreshesTheCookie() {
        String pass = joinAsGuest().getBody().get("accessToken").asText();

        ResponseEntity<JsonNode> renewed = send(HttpMethod.POST, "/api/v1/trips/" + tripId + "/guest-pass", pass,
                null, null);

        assertThat(guestCookie(renewed).getValue()).isEqualTo(renewed.getBody().get("accessToken").asText());
    }
}
