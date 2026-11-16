package com.squadmap.user.dto;

import com.squadmap.user.domain.UserSettings;

public record SettingsResponse(boolean darkMap, UserSettings.DistanceUnit distanceUnit, int defaultShareHours) {

    public static SettingsResponse from(UserSettings settings) {
        return new SettingsResponse(settings.darkMap(), settings.distanceUnit(), settings.defaultShareHours());
    }
}
