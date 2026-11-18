package com.squadmap.chat.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.time.Instant;
import java.util.UUID;

/**
 * Sent on {@code /topic/trip.{id}.chat}: a new message, or someone typing.
 *
 * @param message  the message, for {@link Type#MESSAGE}
 * @param memberId who is typing, for {@link Type#TYPING}
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ChatEvent(Type type, MessageView message, UUID memberId, Instant at) {

    public enum Type {
        MESSAGE,
        /** Someone is writing. Sent at most every 2 seconds per person while they type; never stored. */
        TYPING
    }

    public static ChatEvent message(MessageView message) {
        return new ChatEvent(Type.MESSAGE, message, null, message.sentAt());
    }

    public static ChatEvent typing(UUID memberId, Instant at) {
        return new ChatEvent(Type.TYPING, null, memberId, at);
    }
}
