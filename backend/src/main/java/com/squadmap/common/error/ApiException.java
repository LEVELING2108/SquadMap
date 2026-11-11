package com.squadmap.common.error;

import org.springframework.http.HttpStatus;

/**
 * Thrown by services to return a specific error to the client.
 * The message is shown to the caller, so it must never contain coordinates, tokens or other secrets.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final ErrorCode code;

    public ApiException(HttpStatus status, ErrorCode code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public ErrorCode getCode() {
        return code;
    }
}
