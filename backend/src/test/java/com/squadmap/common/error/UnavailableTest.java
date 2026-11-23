package com.squadmap.common.error;

import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.CannotCreateTransactionException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** A data store that can't be reached is a short-lived 503 to try again, not a 500 that looks like a bug. */
class UnavailableTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void theDatabaseOrRedisBeingUnreachableIsA503ToRetry() {
        for (Exception failure : List.of(
                new CannotCreateTransactionException("Could not open JPA EntityManager for transaction"),
                new DataAccessResourceFailureException("Connection refused"),
                new RedisConnectionFailureException("Unable to connect to Redis"))) {
            ResponseEntity<ProblemDetail> response = handler.handleUnavailable(failure);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
            assertThat(response.getHeaders().getFirst(HttpHeaders.RETRY_AFTER)).isEqualTo("5");
            assertThat(response.getBody().getProperties()).containsEntry("code", "SERVICE_UNAVAILABLE");
            assertThat(response.getBody().getDetail()).contains("try again in a moment");
        }
    }

    @Test
    void anythingElseIsStillAnInternalError() {
        ResponseEntity<ProblemDetail> response = handler.handleUnexpected(new IllegalStateException("bug"));

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody().getProperties()).containsEntry("code", "INTERNAL_ERROR");
    }
}
