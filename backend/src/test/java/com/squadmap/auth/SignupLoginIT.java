package com.squadmap.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SignupLoginIT extends IntegrationTest {

    private static final String SIGNUP = "/api/v1/auth/signup";
    private static final String LOGIN = "/api/v1/auth/login";
    private static final String PASSWORD = "correct horse battery";

    private static Map<String, Object> signupBody(String email) {
        Map<String, Object> body = new HashMap<>();
        body.put("name", "Priya");
        body.put("email", email);
        body.put("password", PASSWORD);
        body.put("acceptedTerms", true);
        return body;
    }

    // --- sign up ---

    @Test
    void signupCreatesTheAccountAndSignsIn() {
        ResponseEntity<JsonNode> response = post(SIGNUP, signupBody("priya@example.com"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);
        JsonNode body = response.getBody();
        assertThat(body.get("accessToken").asText()).isNotBlank();
        assertThat(body.get("expiresIn").asLong()).isEqualTo(900);
        assertThat(body.get("user").get("name").asText()).isEqualTo("Priya");
        assertThat(body.get("user").get("email").asText()).isEqualTo("priya@example.com");
        assertThat(body.get("user").get("color").asText()).matches("#[0-9A-F]{6}");
        assertThat(body.get("user").get("id").asText()).hasSize(36);
    }

    @Test
    void responseNeverContainsThePasswordOrItsHash() {
        ResponseEntity<JsonNode> response = post(SIGNUP, signupBody("priya@example.com"));

        String json = response.getBody().toString();
        assertThat(json).doesNotContain(PASSWORD).doesNotContain("argon2").doesNotContain("passwordHash");
    }

    @Test
    void passwordIsStoredAsAnArgon2idHash() {
        post(SIGNUP, signupBody("priya@example.com"));

        String hash = jdbc.queryForObject("SELECT password_hash FROM users", String.class);
        assertThat(hash).startsWith("$argon2id$").doesNotContain(PASSWORD);
    }

    @Test
    void emailIsStoredTrimmedAndLowerCaseAndTermsAreRecorded() {
        post(SIGNUP, signupBody("  Priya@Example.COM "));

        Map<String, Object> row = jdbc.queryForMap("SELECT email, terms_version, terms_accepted_at FROM users");
        assertThat(row.get("email")).isEqualTo("priya@example.com");
        assertThat(row.get("terms_version")).isNotNull();
        assertThat(row.get("terms_accepted_at")).isNotNull();
    }

    @Test
    void controlCharactersAreStrippedFromTheName() {
        Map<String, Object> body = signupBody("priya@example.com");
        body.put("name", "  Pri\u0000ya\n ");

        ResponseEntity<JsonNode> response = post(SIGNUP, body);

        assertThat(response.getBody().get("user").get("name").asText()).isEqualTo("Priya");
    }

    @Test
    void signupWithAnEmailAlreadyInUseIsRejectedWhateverItsCase() {
        post(SIGNUP, signupBody("priya@example.com"));

        ResponseEntity<JsonNode> response = post(SIGNUP, signupBody("PRIYA@example.com"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getHeaders().getContentType().isCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .isTrue();
        assertThat(response.getBody().get("code").asText()).isEqualTo("EMAIL_TAKEN");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isEqualTo(1);
    }

    @ParameterizedTest(name = "{0} = \"{1}\" is rejected")
    @CsvSource(textBlock = """
            name,     ''
            name,     '   '
            email,    not-an-email
            email,    ''
            password, short
            password, ''
            """)
    void signupRejectsInvalidFields(String field, String value) {
        Map<String, Object> body = signupBody("priya@example.com");
        body.put(field, value);

        ResponseEntity<JsonNode> response = post(SIGNUP, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("VALIDATION_FAILED");
        assertThat(response.getBody().get("errors").findValuesAsText("field")).contains(field);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isZero();
    }

    @Test
    void signupRejectsANameMadeOnlyOfControlCharacters() {
        Map<String, Object> body = signupBody("priya@example.com");
        body.put("name", "\u0001\u0002");

        ResponseEntity<JsonNode> response = post(SIGNUP, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("VALIDATION_FAILED");
    }

    @Test
    void signupRejectsAPasswordLongerThanTheLimit() {
        Map<String, Object> body = signupBody("priya@example.com");
        body.put("password", "x".repeat(129));

        assertThat(post(SIGNUP, body).getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
    }

    @Test
    void signupRequiresAgreeingToTheTerms() {
        Map<String, Object> body = signupBody("priya@example.com");
        body.put("acceptedTerms", false);

        ResponseEntity<JsonNode> response = post(SIGNUP, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("errors").findValuesAsText("field")).contains("acceptedTerms");
    }

    @Test
    void unknownFieldsAreRejected() {
        Map<String, Object> body = signupBody("priya@example.com");
        body.put("role", "admin");

        ResponseEntity<JsonNode> response = post(SIGNUP, body);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("BAD_REQUEST");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM users", Integer.class)).isZero();
    }

    // --- log in ---

    @Test
    void loginWithTheRightPasswordSignsIn() {
        post(SIGNUP, signupBody("priya@example.com"));

        ResponseEntity<JsonNode> response =
                post(LOGIN, Map.of("email", " Priya@Example.com", "password", PASSWORD));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("accessToken").asText()).isNotBlank();
        assertThat(response.getBody().get("user").get("email").asText()).isEqualTo("priya@example.com");
    }

    @Test
    void wrongPasswordAndUnknownEmailGiveTheSameAnswer() {
        post(SIGNUP, signupBody("priya@example.com"));

        ResponseEntity<JsonNode> wrongPassword =
                post(LOGIN, Map.of("email", "priya@example.com", "password", "not the password"));
        ResponseEntity<JsonNode> unknownEmail =
                post(LOGIN, Map.of("email", "nobody@example.com", "password", PASSWORD));

        assertThat(wrongPassword.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(wrongPassword.getBody().get("code").asText()).isEqualTo("INVALID_CREDENTIALS");
        assertThat(unknownEmail.getStatusCode()).isEqualTo(wrongPassword.getStatusCode());
        assertThat(unknownEmail.getBody()).isEqualTo(wrongPassword.getBody());
    }

    @Test
    void anAccountPendingDeletionCannotLogIn() {
        post(SIGNUP, signupBody("priya@example.com"));
        jdbc.update("UPDATE users SET deleted_at = now()");

        ResponseEntity<JsonNode> response =
                post(LOGIN, Map.of("email", "priya@example.com", "password", PASSWORD));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getBody().get("code").asText()).isEqualTo("INVALID_CREDENTIALS");
    }

    @Test
    void loginRejectsMissingFields() {
        ResponseEntity<JsonNode> response = post(LOGIN, Map.of("email", "priya@example.com"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody().get("code").asText()).isEqualTo("VALIDATION_FAILED");
    }
}
