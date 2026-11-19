package com.squadmap.common.error;

import org.springframework.http.HttpStatus;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Thrown by services to return a specific error to the client.
 * The message is shown to the caller, so it must never contain coordinates, tokens or other secrets.
 */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final ErrorCode code;
    private final Map<String, Object> properties = new LinkedHashMap<>();

    public ApiException(HttpStatus status, ErrorCode code, String message) {
        super(message);
        this.status = status;
        this.code = code;
    }

    /** Adds a field to the error body, for details a client needs (for example when a trip ended). */
    public ApiException with(String name, Object value) {
        properties.put(name, value);
        return this;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public ErrorCode getCode() {
        return code;
    }

    public Map<String, Object> getProperties() {
        return Collections.unmodifiableMap(properties);
    }
}
