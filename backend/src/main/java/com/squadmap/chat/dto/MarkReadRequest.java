package com.squadmap.chat.dto;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

/** @param lastSeenId the newest message on screen; it and everything before it count as read */
public record MarkReadRequest(@NotNull(message = "Say which message was seen last.") UUID lastSeenId) {
}
