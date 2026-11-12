package com.squadmap.common.error;

/**
 * Stable machine-readable codes returned in the {@code code} field of every error response.
 * Clients branch on these, so a name is never changed or reused once released.
 */
public enum ErrorCode {
    VALIDATION_FAILED,
    UNAUTHENTICATED,
    FORBIDDEN,
    NOT_FOUND,
    METHOD_NOT_ALLOWED,
    UNSUPPORTED_MEDIA_TYPE,
    PAYLOAD_TOO_LARGE,
    RATE_LIMITED,
    BAD_REQUEST,
    INTERNAL_ERROR,

    // Accounts
    EMAIL_TAKEN,
    INVALID_CREDENTIALS,
    SESSION_EXPIRED,
    RESET_LINK_INVALID,

    // Trips
    TRIP_NOT_FOUND,
    TOO_MANY_TRIPS,
    INVALID_CODE,
    TRIP_EXPIRED,
    TRIP_FULL,
    NOT_HOST,
    EXTEND_LIMIT,
    HOST_CANNOT_LEAVE,
    REQUEST_IN_PROGRESS
}
