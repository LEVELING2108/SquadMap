package com.squadmap.user.domain;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * An account's preferences. Stored as JSON in {@code users.settings}, so adding one needs no migration;
 * anything missing or no longer valid in the stored JSON reads as its default.
 *
 * @param darkMap           maps are always dark; otherwise they follow the app's theme
 * @param distanceUnit      how distances are shown
 * @param defaultShareHours what a new trip's sharing time starts on
 */
public record UserSettings(boolean darkMap, DistanceUnit distanceUnit, int defaultShareHours) {

    /** The sharing times a trip can be created with; matches the trip rules. */
    public static final Set<Integer> SHARE_HOURS = Set.of(1, 2, 4, 8);

    public static final UserSettings DEFAULTS = new UserSettings(false, DistanceUnit.km, 4);

    public enum DistanceUnit { km, mi }

    static UserSettings fromJson(Map<String, Object> stored) {
        if (stored == null) {
            return DEFAULTS;
        }
        boolean darkMap = stored.get("darkMap") instanceof Boolean value ? value : DEFAULTS.darkMap();
        DistanceUnit unit = DEFAULTS.distanceUnit();
        if (stored.get("distanceUnit") instanceof String value) {
            try {
                unit = DistanceUnit.valueOf(value.toLowerCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                // Unknown unit: keep the default.
            }
        }
        int hours = stored.get("defaultShareHours") instanceof Number value && SHARE_HOURS.contains(value.intValue())
                ? value.intValue() : DEFAULTS.defaultShareHours();
        return new UserSettings(darkMap, unit, hours);
    }

    Map<String, Object> toJson() {
        Map<String, Object> json = new HashMap<>();
        json.put("darkMap", darkMap);
        json.put("distanceUnit", distanceUnit.name());
        json.put("defaultShareHours", defaultShareHours);
        return json;
    }
}
