package com.squadmap.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import com.squadmap.Mailpit;
import com.squadmap.auth.service.PasswordResetService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

/** "Forgot password", checked end to end through the email that actually gets sent. */
class PasswordResetIT extends IntegrationTest {

    private static final String FORGOT = "/api/v1/auth/forgot";
    private static final String RESET = "/api/v1/auth/reset";
    private static final String LOGIN = "/api/v1/auth/login";
    private static final String EMAIL = "priya@example.com";
    private static final String OLD_PASSWORD = "correct horse battery";
    private static final String NEW_PASSWORD = "a brand new passphrase";

    @Autowired
    private PasswordResetService passwordReset;

    private String refreshCookie;

    @BeforeEach
    void signUp() {
        ResponseEntity<JsonNode> signup = post("/api/v1/auth/signup", Map.of(
                "name", "Priya <b>", "email", EMAIL, "password", OLD_PASSWORD, "acceptedTerms", true));
        String header = signup.getHeaders().getFirst(HttpHeaders.SET_COOKIE);
        refreshCookie = header.substring(header.indexOf('=') + 1, header.indexOf(';'));
    }

    private Mailpit.Email requestLink() {
        assertThat(post(FORGOT, Map.of("email", EMAIL)).getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        return mailpit.awaitOneTo(EMAIL);
    }

    private ResponseEntity<JsonNode> reset(String token, String password) {
        return post(RESET, Map.of("token", token, "password", password));
    }

    private HttpStatus login(String password) {
        return HttpStatus.valueOf(post(LOGIN, Map.of("email", EMAIL, "password", password))
                .getStatusCode().value());
    }

    // --- asking for a link ---

    @Test
    void sendsAnEmailWithASingleUseLinkToTheWebApp() {
        Mailpit.Email email = requestLink();

        assertThat(email.subject()).isEqualTo("Reset your SquadMap password");
        assertThat(email.text()).contains("http://localhost:5480/reset-password#token=");
        assertThat(email.text()).contains("30 minutes");
        assertThat(email.html()).contains("reset-password#token=");
        assertThat(email.resetToken()).hasSize(43);
    }

    @Test
    void escapesTheNameInTheHtmlEmail() {
        Mailpit.Email email = requestLink();

        assertThat(email.html()).contains("Priya &lt;b&gt;").doesNotContain("Priya <b>");
    }

    @Test
    void answersTheSameForAnUnknownEmailAndSendsNothing() {
        ResponseEntity<JsonNode> known = post(FORGOT, Map.of("email", EMAIL));
        ResponseEntity<JsonNode> unknown = post(FORGOT, Map.of("email", "nobody@example.com"));

        assertThat(unknown.getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(unknown.getStatusCode()).isEqualTo(known.getStatusCode());
        assertThat(unknown.getBody()).isEqualTo(known.getBody());
        assertThat(mailpit.settledMessagesTo("nobody@example.com")).isEmpty();
    }

    @Test
    void sendsNothingForAnAccountPendingDeletion() {
        jdbc.update("UPDATE users SET deleted_at = now()");

        assertThat(post(FORGOT, Map.of("email", EMAIL)).getStatusCode()).isEqualTo(HttpStatus.ACCEPTED);
        assertThat(mailpit.settledMessagesTo(EMAIL)).isEmpty();
    }

    @Test
    void matchesTheEmailWhateverItsCase() {
        assertThat(post(FORGOT, Map.of("email", "  PRIYA@Example.com ")).getStatusCode())
                .isEqualTo(HttpStatus.ACCEPTED);

        assertThat(mailpit.awaitOneTo(EMAIL)).isNotNull();
    }

    @Test
    void rejectsAMalformedEmail() {
        ResponseEntity<JsonNode> response = post(FORGOT, Map.of("email", "not-an-email"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void storesOnlyAHashOfTheLink() {
        String token = requestLink().resetToken();

        String stored = jdbc.queryForObject("SELECT token_hash FROM password_reset_tokens", String.class);
        assertThat(stored).hasSize(64).isNotEqualTo(token);
    }

    // --- using the link ---

    @Test
    void theLinkSetsANewPassword() {
        String token = requestLink().resetToken();

        ResponseEntity<JsonNode> response = reset(token, NEW_PASSWORD);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        assertThat(login(NEW_PASSWORD)).isEqualTo(HttpStatus.OK);
        assertThat(login(OLD_PASSWORD)).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void resettingSignsTheAccountOutEverywhere() {
        String token = requestLink().resetToken();

        reset(token, NEW_PASSWORD);

        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.COOKIE, "sm_refresh=" + refreshCookie);
        ResponseEntity<JsonNode> refresh = rest.exchange("/api/v1/auth/refresh", HttpMethod.POST,
                new HttpEntity<>(headers), JsonNode.class);
        assertThat(refresh.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(refresh.getBody().get("code").asText()).isEqualTo("SESSION_EXPIRED");
    }

    @Test
    void theLinkWorksOnlyOnce() {
        String token = requestLink().resetToken();
        reset(token, NEW_PASSWORD);

        ResponseEntity<JsonNode> again = reset(token, "yet another passphrase");

        assertThat(again.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(again.getBody().get("code").asText()).isEqualTo("RESET_LINK_INVALID");
        assertThat(login(NEW_PASSWORD)).isEqualTo(HttpStatus.OK);
    }

    @Test
    void anExpiredLinkIsRejected() {
        String token = requestLink().resetToken();
        jdbc.update("UPDATE password_reset_tokens SET expires_at = now() - interval '1 second'");

        ResponseEntity<JsonNode> response = reset(token, NEW_PASSWORD);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("RESET_LINK_INVALID");
        assertThat(login(OLD_PASSWORD)).isEqualTo(HttpStatus.OK);
    }

    @Test
    void aNewerLinkCancelsTheOlderOne() {
        String first = requestLink().resetToken();
        mailpit.deleteAll();
        String second = requestLink().resetToken();

        assertThat(reset(first, NEW_PASSWORD).getBody().get("code").asText()).isEqualTo("RESET_LINK_INVALID");
        assertThat(reset(second, NEW_PASSWORD).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void anUnknownTokenIsRejected() {
        ResponseEntity<JsonNode> response = reset("made-up-value-that-was-never-issued-0000000", NEW_PASSWORD);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("RESET_LINK_INVALID");
    }

    @Test
    void theNewPasswordMustMeetTheSameRulesAsSignUp() {
        String token = requestLink().resetToken();

        ResponseEntity<JsonNode> response = reset(token, "short");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("VALIDATION_FAILED");
        // A rejected password does not use up the link.
        assertThat(reset(token, NEW_PASSWORD).getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
    }

    @Test
    void aLinkForAnAccountPendingDeletionIsRejected() {
        String token = requestLink().resetToken();
        jdbc.update("UPDATE users SET deleted_at = now()");

        assertThat(reset(token, NEW_PASSWORD).getBody().get("code").asText()).isEqualTo("RESET_LINK_INVALID");
    }

    @Test
    void purgeRemovesExpiredLinks() {
        requestLink();
        jdbc.update("UPDATE password_reset_tokens SET expires_at = now() - interval '1 hour'");

        assertThat(passwordReset.purgeExpired()).isEqualTo(1);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM password_reset_tokens", Integer.class)).isZero();
    }

    @Test
    void noEmailIsSentForOtherAuthActions() {
        post(LOGIN, Map.of("email", EMAIL, "password", OLD_PASSWORD));

        List<Mailpit.Email> messages = mailpit.settledMessagesTo(EMAIL);
        assertThat(messages).isEmpty();
    }
}
