package com.squadmap.location.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.squadmap.common.error.ErrorCode;

/**
 * A refused live update, sent only to the sender on {@code /user/queue/errors}.
 *
 * @param retryAfter seconds to wait, for {@code RATE_LIMITED}
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record LiveError(ErrorCode code, String message, Long retryAfter) {
}
