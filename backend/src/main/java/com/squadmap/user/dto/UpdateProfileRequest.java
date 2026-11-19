package com.squadmap.user.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Changes the name and/or colour; anything left out keeps its value.
 *
 * @param color one of the avatar colours, as "#RRGGBB"
 */
public record UpdateProfileRequest(
        @Size(max = 60, message = "Use 60 characters or fewer.") String name,
        @Pattern(regexp = "#[0-9A-Fa-f]{6}", message = "Choose one of the colours shown.") String color) {
}
