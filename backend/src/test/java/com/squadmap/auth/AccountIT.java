package com.squadmap.auth;

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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class AccountIT extends IntegrationTest {

    private static final String EMAIL = "priya@example.com";
    private static final String PASSWORD = "correct horse battery";

    /** One signed-in device: its access token and its refresh cookie. */
    private record Device(String accessToken, String cookie) {
    }

    @BeforeEach
    void signUp() {
        post("/api/v1/auth/signup", Map.of("name", "Priya", "email", EMAIL, "password", PASSWORD,
                "acceptedTerms", true));
    }

    private Device logIn(String email, String password) {
        ResponseEntity<JsonNode> response = post("/api/v1/auth/login", Map.of("email", email, "password", password));
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        String cookie = response.getHeaders().get(HttpHeaders.SET_COOKIE).get(0).split(";")[0];
        return new Device(response.getBody().get("accessToken").asText(), cookie);
    }

    private ResponseEntity<JsonNode> send(HttpMethod method, String path, Device device, Object body) {
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        if (device != null) {
            headers.setBearerAuth(device.accessToken());
            headers.add(HttpHeaders.COOKIE, device.cookie());
        }
        return rest.exchange(path, method, new HttpEntity<>(body, headers), JsonNode.class);
    }

    /** Whether the device's session still exists: a refresh with its cookie succeeds. */
    private boolean stillSignedIn(Device device) {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, device.cookie());
        return rest.exchange("/api/v1/auth/refresh", HttpMethod.POST, new HttpEntity<>(null, headers), JsonNode.class)
                .getStatusCode().is2xxSuccessful();
    }

    private static Map<String, Object> passwordChange(String current, String next) {
        Map<String, Object> body = new HashMap<>();
        body.put("currentPassword", current);
        body.put("newPassword", next);
        return body;
    }

    // --- password ---

    @Test
    void changingThePasswordKeepsThisDeviceAndEndsTheOthers() {
        Device phone = logIn(EMAIL, PASSWORD);
        Device laptop = logIn(EMAIL, PASSWORD);

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/auth/password", phone,
                passwordChange(PASSWORD, "a whole new passphrase"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(stillSignedIn(laptop)).isFalse();
        assertThat(stillSignedIn(phone)).isTrue();
        assertThat(post("/api/v1/auth/login", Map.of("email", EMAIL, "password", PASSWORD)).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
        logIn(EMAIL, "a whole new passphrase");
    }

    @Test
    void aWrongCurrentPasswordChangesNothing() {
        Device phone = logIn(EMAIL, PASSWORD);

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/auth/password", phone,
                passwordChange("not my password", "a whole new passphrase"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("errors").get(0).get("field").asText()).isEqualTo("currentPassword");
        assertThat(response.getBody().get("errors").get(0).get("message").asText())
                .isEqualTo("That isn't your current password.");
        logIn(EMAIL, PASSWORD);
    }

    @Test
    void theNewPasswordMustBeLongEnoughAndNew() {
        Device phone = logIn(EMAIL, PASSWORD);

        ResponseEntity<JsonNode> tooShort = send(HttpMethod.POST, "/api/v1/auth/password", phone,
                passwordChange(PASSWORD, "short"));
        ResponseEntity<JsonNode> same = send(HttpMethod.POST, "/api/v1/auth/password", phone,
                passwordChange(PASSWORD, PASSWORD));

        assertThat(tooShort.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(tooShort.getBody().get("errors").get(0).get("field").asText()).isEqualTo("newPassword");
        assertThat(same.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(same.getBody().get("errors").get(0).get("field").asText()).isEqualTo("newPassword");
    }

    @Test
    void fiveWrongPasswordsPauseFurtherTriesEvenWithTheRightOne() {
        Device phone = logIn(EMAIL, PASSWORD);
        for (int i = 0; i < 5; i++) {
            assertThat(send(HttpMethod.POST, "/api/v1/auth/password", phone,
                    passwordChange("guess " + i, "a whole new passphrase")).getStatusCode())
                    .isEqualTo(HttpStatus.BAD_REQUEST);
        }

        ResponseEntity<JsonNode> right = send(HttpMethod.POST, "/api/v1/auth/password", phone,
                passwordChange(PASSWORD, "a whole new passphrase"));
        ResponseEntity<JsonNode> viaEmail = send(HttpMethod.PUT, "/api/v1/me/email", phone,
                Map.of("email", "new@example.com", "password", PASSWORD));

        assertThat(right.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
        assertThat(viaEmail.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
    }

    @Test
    void aPasswordChangeCancelsResetLinksAlreadySent() {
        Device phone = logIn(EMAIL, PASSWORD);
        post("/api/v1/auth/forgot", Map.of("email", EMAIL));
        String token = mailpit.awaitOneTo(EMAIL).resetToken();

        send(HttpMethod.POST, "/api/v1/auth/password", phone, passwordChange(PASSWORD, "a whole new passphrase"));

        assertThat(post("/api/v1/auth/reset", Map.of("token", token, "password", "someone else's pick"))
                .getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    // --- sessions ---

    @Test
    void loggingOutEverywhereElseKeepsOnlyThisDevice() {
        Device phone = logIn(EMAIL, PASSWORD);
        Device laptop = logIn(EMAIL, PASSWORD);
        Device tablet = logIn(EMAIL, PASSWORD);

        ResponseEntity<JsonNode> response = send(HttpMethod.POST, "/api/v1/auth/logout-others", phone, null);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(stillSignedIn(laptop)).isFalse();
        assertThat(stillSignedIn(tablet)).isFalse();
        assertThat(stillSignedIn(phone)).isTrue();
    }

    @Test
    void anotherAccountsCookieCannotBeUsedToKeepASession() {
        post("/api/v1/auth/signup", Map.of("name", "Aman", "email", "aman@example.com", "password", PASSWORD,
                "acceptedTerms", true));
        Device priya = logIn(EMAIL, PASSWORD);
        Device priyaLaptop = logIn(EMAIL, PASSWORD);
        Device aman = logIn("aman@example.com", PASSWORD);

        // Priya's token with Aman's cookie: no session of Priya's is kept, so all of hers end.
        send(HttpMethod.POST, "/api/v1/auth/logout-others", new Device(priya.accessToken(), aman.cookie()), null);

        assertThat(stillSignedIn(priya)).isFalse();
        assertThat(stillSignedIn(priyaLaptop)).isFalse();
        assertThat(stillSignedIn(aman)).isTrue();
    }

    // --- email ---

    @Test
    void changingTheEmailMovesTheLoginAndTellsTheOldAddress() {
        Device phone = logIn(EMAIL, PASSWORD);

        ResponseEntity<JsonNode> response = send(HttpMethod.PUT, "/api/v1/me/email", phone,
                Map.of("email", "Priya.New@Example.com", "password", PASSWORD));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("email").asText()).isEqualTo("priya.new@example.com");
        logIn("priya.new@example.com", PASSWORD);
        assertThat(post("/api/v1/auth/login", Map.of("email", EMAIL, "password", PASSWORD)).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);

        var notice = mailpit.awaitOneTo(EMAIL);
        assertThat(notice.subject()).isEqualTo("Your SquadMap email address changed");
        assertThat(notice.text()).contains("pr***@example.com").doesNotContain("priya.new@example.com");
        assertThat(mailpit.settledMessagesTo("priya.new@example.com")).isEmpty();
    }

    @Test
    void anEmailInUseOrUnchangedIsRefused() {
        post("/api/v1/auth/signup", Map.of("name", "Aman", "email", "aman@example.com", "password", PASSWORD,
                "acceptedTerms", true));
        Device phone = logIn(EMAIL, PASSWORD);

        ResponseEntity<JsonNode> taken = send(HttpMethod.PUT, "/api/v1/me/email", phone,
                Map.of("email", "AMAN@example.com", "password", PASSWORD));
        ResponseEntity<JsonNode> same = send(HttpMethod.PUT, "/api/v1/me/email", phone,
                Map.of("email", EMAIL, "password", PASSWORD));
        ResponseEntity<JsonNode> wrongPassword = send(HttpMethod.PUT, "/api/v1/me/email", phone,
                Map.of("email", "free@example.com", "password", "nope"));
        ResponseEntity<JsonNode> notAnEmail = send(HttpMethod.PUT, "/api/v1/me/email", phone,
                Map.of("email", "not-an-email", "password", PASSWORD));

        assertThat(taken.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(taken.getBody().get("code").asText()).isEqualTo("EMAIL_TAKEN");
        assertThat(same.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(wrongPassword.getBody().get("errors").get(0).get("field").asText()).isEqualTo("password");
        assertThat(notAnEmail.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(mailpit.settledMessagesTo(EMAIL)).isEmpty();
    }

    @Test
    void accountChangesNeedAnAccountNotAGuestPass() {
        Device phone = logIn(EMAIL, PASSWORD);
        Map<String, Object> trip = Map.of("name", "Trip", "shareHours", 2, "chatEnabled", true);
        String code = send(HttpMethod.POST, "/api/v1/trips", phone, trip).getBody().get("code").asText();
        String guest = post("/api/v1/join/" + code, Map.of("displayName", "Sourav", "shareLocation", false))
                .getBody().get("accessToken").asText();
        Device guestDevice = new Device(guest, "x=y");

        for (ResponseEntity<JsonNode> response : List.of(
                send(HttpMethod.POST, "/api/v1/auth/password", guestDevice, passwordChange(PASSWORD, "whatever 123")),
                send(HttpMethod.POST, "/api/v1/auth/logout-others", guestDevice, null),
                send(HttpMethod.PUT, "/api/v1/me/email", guestDevice, Map.of("email", "g@example.com", "password", "x")),
                send(HttpMethod.PATCH, "/api/v1/me", guestDevice, Map.of("name", "Hacker")))) {
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        }
        assertThat(send(HttpMethod.POST, "/api/v1/auth/logout-others", null, null).getStatusCode())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    // --- name and colour ---

    @Test
    void nameAndColourCanBeChangedAndOnlyFromThePalette() {
        Device phone = logIn(EMAIL, PASSWORD);

        ResponseEntity<JsonNode> renamed = send(HttpMethod.PATCH, "/api/v1/me", phone, Map.of("name", "  Priya S  "));
        ResponseEntity<JsonNode> recoloured = send(HttpMethod.PATCH, "/api/v1/me", phone, Map.of("color", "#534ab7"));
        ResponseEntity<JsonNode> offPalette = send(HttpMethod.PATCH, "/api/v1/me", phone, Map.of("color", "#FFFFFF"));
        ResponseEntity<JsonNode> blank = send(HttpMethod.PATCH, "/api/v1/me", phone, Map.of("name", "   "));

        assertThat(renamed.getBody().get("name").asText()).isEqualTo("Priya S");
        assertThat(recoloured.getBody().get("color").asText()).isEqualTo("#534AB7");
        assertThat(recoloured.getBody().get("name").asText()).isEqualTo("Priya S");
        assertThat(offPalette.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(offPalette.getBody().get("errors").get(0).get("field").asText()).isEqualTo("color");
        assertThat(blank.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(get("/api/v1/me", phone.accessToken()).getBody().get("color").asText()).isEqualTo("#534AB7");
    }

    @Test
    void theColourListIsThePalette() {
        Device phone = logIn(EMAIL, PASSWORD);

        JsonNode colors = get("/api/v1/me/colors", phone.accessToken()).getBody();

        assertThat(colors).hasSize(5);
        colors.forEach(color -> assertThat(color.asText()).matches("#[0-9A-F]{6}"));
    }

    @Test
    void aNewNameIsUsedForTripsFromNowOnButNotRewrittenOnPastOnes() {
        Device phone = logIn(EMAIL, PASSWORD);
        Map<String, Object> trip = Map.of("name", "Before", "shareHours", 2, "chatEnabled", true);
        String before = send(HttpMethod.POST, "/api/v1/trips", phone, trip).getBody().get("id").asText();

        send(HttpMethod.PATCH, "/api/v1/me", phone, Map.of("name", "Priya S"));
        String after = send(HttpMethod.POST, "/api/v1/trips", phone, Map.of("name", "After", "shareHours", 2,
                "chatEnabled", true)).getBody().get("id").asText();

        assertThat(jdbc.queryForObject("SELECT display_name FROM trip_members WHERE trip_id = ?::uuid",
                String.class, before)).isEqualTo("Priya");
        assertThat(jdbc.queryForObject("SELECT display_name FROM trip_members WHERE trip_id = ?::uuid",
                String.class, after)).isEqualTo("Priya S");
    }
}
