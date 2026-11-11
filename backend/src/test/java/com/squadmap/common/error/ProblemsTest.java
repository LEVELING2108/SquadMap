package com.squadmap.common.error;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;

import static org.assertj.core.api.Assertions.assertThat;

class ProblemsTest {

    @Test
    void problemCarriesStatusDetailAndCode() {
        ProblemDetail problem = Problems.of(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED, "Slow down.");

        assertThat(problem.getStatus()).isEqualTo(429);
        assertThat(problem.getDetail()).isEqualTo("Slow down.");
        assertThat(problem.getProperties()).containsEntry("code", "RATE_LIMITED");
    }

    @Test
    void knownStatusesMapToTheirOwnCode() {
        assertThat(Problems.codeFor(HttpStatus.UNAUTHORIZED)).isEqualTo(ErrorCode.UNAUTHENTICATED);
        assertThat(Problems.codeFor(HttpStatus.FORBIDDEN)).isEqualTo(ErrorCode.FORBIDDEN);
        assertThat(Problems.codeFor(HttpStatus.NOT_FOUND)).isEqualTo(ErrorCode.NOT_FOUND);
        assertThat(Problems.codeFor(HttpStatus.TOO_MANY_REQUESTS)).isEqualTo(ErrorCode.RATE_LIMITED);
    }

    @Test
    void otherClientErrorsFallBackToBadRequest() {
        assertThat(Problems.codeFor(HttpStatus.CONFLICT)).isEqualTo(ErrorCode.BAD_REQUEST);
        assertThat(Problems.codeFor(HttpStatusCode.valueOf(499))).isEqualTo(ErrorCode.BAD_REQUEST);
    }

    @Test
    void serverErrorsNeverLeakASpecificCode() {
        assertThat(Problems.codeFor(HttpStatus.BAD_GATEWAY)).isEqualTo(ErrorCode.INTERNAL_ERROR);
        assertThat(Problems.codeFor(HttpStatusCode.valueOf(599))).isEqualTo(ErrorCode.INTERNAL_ERROR);
    }
}
