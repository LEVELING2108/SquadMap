package com.squadmap.user.dto;

import com.squadmap.user.domain.UserSettings;

public record SettingsResponse(boolean darkMap, UserSettings.DistanceUnit distanceUnit, int defaultShareHours,
                               UserSettings.MapStyle mapStyle, boolean chatDefault, boolean reduceMotion,
                               UserSettings.TimeFormat timeFormat) {

    public static SettingsResponse from(UserSettings settings) {
        return new SettingsResponse(settings.darkMap(), settings.distanceUnit(), settings.defaultShareHours(),
                settings.mapStyle(), settings.chatDefault(), settings.reduceMotion(), settings.timeFormat());
    }
}
