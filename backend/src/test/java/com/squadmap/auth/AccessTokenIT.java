package com.squadmap.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.squadmap.IntegrationTest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

import javax.crypto.spec.SecretKeySpec;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.function.Consumer;

import static org.assertj.core.api.Assertions.assertThat;

/** Who may call the account routes: only a valid, unexpired token issued to a signed-in account. */
class AccessTokenIT extends IntegrationTest {

    private static final String ME = "/api/v1/me";

    @Autowired
    private JwtEncoder encoder;

    private String userId;
    private String accessToken;

    @BeforeEach
    void signUp() {
        JsonNode body = post("/api/v1/auth/signup", Map.of(
                "name", "Priya", "email", "priya@example.com",
                "password", "correct horse battery", "acceptedTerms", true)).getBody();
        userId = body.get("user").get("id").asText();
        accessToken = body.get("accessToken").asText();
    }

    private String token(JwtEncoder with, Consumer<JwtClaimsSet.Builder> customise) {
        Instant now = Instant.now();
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer("squadmap")
                .subject(userId)
                .issuedAt(now)
                .expiresAt(now.plus(15, ChronoUnit.MINUTES))
                .claim("kind", "user");
        customise.accept(claims);
        return with.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims.build()))
                .getTokenValue();
    }

    private void assertRejected(String bearer, HttpStatus status, String code) {
        ResponseEntity<JsonNode> response = get(ME, bearer);
        assertThat(response.getStatusCode()).isEqualTo(status);
        assertThat(response.getBody().get("code").asText()).isEqualTo(code);
    }

    @Test
    void returnsTheProfileForAValidToken() {
        ResponseEntity<JsonNode> response = get(ME, accessToken);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("id").asText()).isEqualTo(userId);
        assertThat(response.getBody().get("email").asText()).isEqualTo("priya@example.com");
        assertThat(response.getBody().has("passwordHash")).isFalse();
    }

    @Test
    void rejectsARequestWithNoToken() {
        assertRejected(null, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }

    @Test
    void rejectsGarbage() {
        assertRejected("not-a-token", HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }

    @Test
    void rejectsAnExpiredToken() {
        Instant past = Instant.now().minus(2, ChronoUnit.HOURS);
        String expired = token(encoder, claims -> claims.issuedAt(past).expiresAt(past.plus(15, ChronoUnit.MINUTES)));

        assertRejected(expired, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }

    @Test
    void rejectsATokenSignedWithAnotherKey() {
        byte[] otherKey = "a-completely-different-signing-key-0123456789".getBytes();
        JwtEncoder attacker = new NimbusJwtEncoder(new ImmutableSecret<>(new SecretKeySpec(otherKey, "HmacSHA256")));

        assertRejected(token(attacker, claims -> { }), HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }

    @Test
    void rejectsATokenFromAnotherIssuer() {
        assertRejected(token(encoder, claims -> claims.issuer("someone-else")),
                HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }

    @Test
    void rejectsATokenWithNoKind() {
        assertRejected(token(encoder, claims -> claims.claims(all -> all.remove("kind"))),
                HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }

    @Test
    void rejectsATokenWithAnUnknownKind() {
        assertRejected(token(encoder, claims -> claims.claim("kind", "admin")),
                HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }

    @Test
    void forbidsAGuestTokenOnAccountRoutes() {
        assertRejected(token(encoder, claims -> claims.claim("kind", "guest")),
                HttpStatus.FORBIDDEN, "FORBIDDEN");
    }

    @Test
    void rejectsAValidTokenOnceTheAccountIsGone() {
        jdbc.update("UPDATE users SET deleted_at = now()");

        assertRejected(accessToken, HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED");
    }

    @Test
    void preflightFromTheWebAppOriginIsAllowed() {
        ResponseEntity<String> response = preflight(ALLOWED_ORIGIN);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getHeaders().getAccessControlAllowOrigin()).isEqualTo(ALLOWED_ORIGIN);
        assertThat(response.getHeaders().getAccessControlAllowCredentials()).isTrue();
    }

    @Test
    void preflightFromAnyOtherOriginIsRefusedWith403() {
        ResponseEntity<String> response = preflight("https://evil.example");

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        assertThat(response.getHeaders().getAccessControlAllowOrigin()).isNull();
    }

    private ResponseEntity<String> preflight(String origin) {
        HttpHeaders headers = new HttpHeaders();
        headers.setOrigin(origin);
        headers.setAccessControlRequestMethod(HttpMethod.POST);
        return rest.exchange("/api/v1/auth/login", HttpMethod.OPTIONS, new HttpEntity<>(headers), String.class);
    }
}
