package com.squadmap.chat.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * @param clientId optional, chosen by the app: sending again with the same one returns the first message
 *                 instead of posting it twice, and lets the app match the live copy to what it showed
 */
public record SendMessageRequest(
        @NotBlank(message = "Write a message.")
        @Size(max = 280, message = "Use 280 characters or fewer.")
        String text,

        UUID clientId) {
}
