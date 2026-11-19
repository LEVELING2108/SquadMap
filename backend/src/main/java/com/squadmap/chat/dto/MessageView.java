package com.squadmap.chat.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

/**
 * One chat message, with who wrote it as they appear on the trip.
 *
 * @param clientId the id the sender's app chose, if any
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record MessageView(UUID id, UUID memberId, String displayName, String color, String text,
                          Instant sentAt, UUID clientId) {
}
