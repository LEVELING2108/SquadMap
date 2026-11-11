package com.squadmap.common.error;

import com.squadmap.common.ratelimit.RateLimitedException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;

/** Builds RFC 7807 problem responses that always carry a stable {@code code}. */
public final class Problems {

    public static final String CODE_PROPERTY = "code";

    private Problems() {
    }

    public static ProblemDetail of(HttpStatusCode status, ErrorCode code, String detail) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setProperty(CODE_PROPERTY, code.name());
        return problem;
    }

    /** The response for a service error, including {@code Retry-After} when it is a rate limit. */
    public static ResponseEntity.BodyBuilder responseFor(ApiException ex) {
        ResponseEntity.BodyBuilder response = ResponseEntity.status(ex.getStatus());
        if (ex instanceof RateLimitedException limited) {
            response.header(HttpHeaders.RETRY_AFTER, String.valueOf(limited.getRetryAfterSeconds()));
        }
        return response;
    }

    public static ProblemDetail bodyFor(ApiException ex) {
        ProblemDetail problem = of(ex.getStatus(), ex.getCode(), ex.getMessage());
        if (ex instanceof RateLimitedException limited) {
            problem.setProperty("retryAfter", limited.getRetryAfterSeconds());
        }
        return problem;
    }

    /** The code used when a framework error carries only an HTTP status. */
    public static ErrorCode codeFor(HttpStatusCode status) {
        HttpStatus resolved = HttpStatus.resolve(status.value());
        if (resolved == null) {
            return status.is4xxClientError() ? ErrorCode.BAD_REQUEST : ErrorCode.INTERNAL_ERROR;
        }
        return switch (resolved) {
            case UNAUTHORIZED -> ErrorCode.UNAUTHENTICATED;
            case FORBIDDEN -> ErrorCode.FORBIDDEN;
            case NOT_FOUND -> ErrorCode.NOT_FOUND;
            case METHOD_NOT_ALLOWED -> ErrorCode.METHOD_NOT_ALLOWED;
            case UNSUPPORTED_MEDIA_TYPE -> ErrorCode.UNSUPPORTED_MEDIA_TYPE;
            case PAYLOAD_TOO_LARGE -> ErrorCode.PAYLOAD_TOO_LARGE;
            case TOO_MANY_REQUESTS -> ErrorCode.RATE_LIMITED;
            default -> resolved.is4xxClientError() ? ErrorCode.BAD_REQUEST : ErrorCode.INTERNAL_ERROR;
        };
    }
}
