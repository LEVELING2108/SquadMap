package com.squadmap.common.ratelimit;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import org.springframework.http.HttpStatus;

/** 429 with how long to wait, sent as the {@code Retry-After} header and a {@code retryAfter} field. */
public class RateLimitedException extends ApiException {

    private final long retryAfterSeconds;

    public RateLimitedException(long retryAfterSeconds) {
        super(HttpStatus.TOO_MANY_REQUESTS, ErrorCode.RATE_LIMITED, "Too many attempts. Wait a moment and try again.");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
