package com.squadmap;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import static org.assertj.core.api.Assertions.assertThat;

class ApplicationSmokeIT extends IntegrationTest {

    @Test
    void healthIsPublicAndUpWithDatabaseAndRedisConnected() {
        ResponseEntity<JsonNode> response = rest.getForEntity("/actuator/health", JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().get("status").asText()).isEqualTo("UP");
    }

    @Test
    void healthDoesNotExposeComponentDetails() {
        ResponseEntity<JsonNode> response = rest.getForEntity("/actuator/health", JsonNode.class);

        assertThat(response.getBody().has("components")).isFalse();
    }

    @Test
    void migrationsAreApplied() {
        Integer failed = jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE NOT success", Integer.class);
        Integer baseline = jdbc.queryForObject(
                "SELECT count(*) FROM flyway_schema_history WHERE version = '1' AND success", Integer.class);

        assertThat(failed).isZero();
        assertThat(baseline).isEqualTo(1);
    }

    @Test
    void unknownApiRouteIsRejectedWithProblemJsonWhenNotSignedIn() {
        ResponseEntity<JsonNode> response = rest.getForEntity("/api/v1/no-such-route", JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
        assertThat(response.getHeaders().getContentType().isCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .isTrue();
        assertThat(response.getBody().get("status").asInt()).isEqualTo(401);
        assertThat(response.getBody().get("code").asText()).isEqualTo("UNAUTHENTICATED");
    }

    @Test
    void metricsEndpointIsNotPublic() {
        ResponseEntity<String> response = rest.getForEntity("/actuator/prometheus", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void apiDocsAreServedOutsideProduction() {
        ResponseEntity<JsonNode> response = rest.getForEntity("/v3/api-docs", JsonNode.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody().has("openapi")).isTrue();
    }
}
