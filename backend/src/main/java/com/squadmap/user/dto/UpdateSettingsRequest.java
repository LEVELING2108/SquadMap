package com.squadmap.user.dto;

import jakarta.validation.constraints.Pattern;

/**
 * Changes some settings; anything left out keeps its value.
 *
 * @param distanceUnit      "km" or "mi"
 * @param defaultShareHours 1, 2, 4 or 8
 */
public record UpdateSettingsRequest(
        Boolean darkMap,
        @Pattern(regexp = "km|mi", message = "Choose km or mi.") String distanceUnit,
        Integer defaultShareHours) {
}
