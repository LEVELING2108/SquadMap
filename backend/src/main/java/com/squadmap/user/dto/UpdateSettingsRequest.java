package com.squadmap.user.dto;

import jakarta.validation.constraints.Pattern;

/**
 * Changes some settings; anything left out keeps its value.
 *
 * @param distanceUnit      "km" or "mi"
 * @param defaultShareHours 1, 2, 4 or 8
 * @param mapStyle          "streets", "outdoors" or "satellite"
 * @param timeFormat        "12h" or "24h"
 */
public record UpdateSettingsRequest(
        Boolean darkMap,
        @Pattern(regexp = "km|mi", message = "Choose km or mi.") String distanceUnit,
        Integer defaultShareHours,
        @Pattern(regexp = "streets|outdoors|satellite", message = "Choose streets, outdoors or satellite.")
        String mapStyle,
        Boolean chatDefault,
        Boolean reduceMotion,
        @Pattern(regexp = "12h|24h", message = "Choose 12h or 24h.") String timeFormat) {
}
