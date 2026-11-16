package com.squadmap.user.domain;

import com.fasterxml.jackson.annotation.JsonValue;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * An account's preferences. Stored as JSON in {@code users.settings}, so adding one needs no migration;
 * anything missing or no longer valid in the stored JSON reads as its default.
 *
 * @param darkMap           Streets maps are always dark; otherwise they follow the app's theme
 * @param distanceUnit      how distances are shown
 * @param defaultShareHours what a new trip's sharing time starts on
 * @param mapStyle          the look of every map
 * @param chatDefault       whether "Friends can chat" starts on for a new trip
 * @param reduceMotion      turns off the app's moving effects, even where the device allows them
 * @param timeFormat        how clock times are shown
 */
public record UserSettings(boolean darkMap, DistanceUnit distanceUnit, int defaultShareHours, MapStyle mapStyle,
                           boolean chatDefault, boolean reduceMotion, TimeFormat timeFormat) {

    /** The sharing times a trip can be created with; matches the trip rules. */
    public static final Set<Integer> SHARE_HOURS = Set.of(1, 2, 4, 8);

    public static final UserSettings DEFAULTS =
            new UserSettings(false, DistanceUnit.km, 4, MapStyle.streets, true, false, TimeFormat.h12);

    public enum DistanceUnit { km, mi }

    public enum MapStyle { streets, outdoors, satellite }

    /** Written as "12h" and "24h" in JSON and the API. */
    public enum TimeFormat {
        h12("12h"), h24("24h");

        private final String value;

        TimeFormat(String value) {
            this.value = value;
        }

        @JsonValue
        public String value() {
            return value;
        }

        public static TimeFormat parse(String value) {
            for (TimeFormat format : values()) {
                if (format.value.equals(value)) {
                    return format;
                }
            }
            throw new IllegalArgumentException("Unknown time format");
        }
    }

    static UserSettings fromJson(Map<String, Object> stored) {
        if (stored == null) {
            return DEFAULTS;
        }
        return new UserSettings(
                bool(stored, "darkMap", DEFAULTS.darkMap()),
                choice(stored, "distanceUnit", DistanceUnit.class, DEFAULTS.distanceUnit()),
                stored.get("defaultShareHours") instanceof Number value && SHARE_HOURS.contains(value.intValue())
                        ? value.intValue() : DEFAULTS.defaultShareHours(),
                choice(stored, "mapStyle", MapStyle.class, DEFAULTS.mapStyle()),
                bool(stored, "chatDefault", DEFAULTS.chatDefault()),
                bool(stored, "reduceMotion", DEFAULTS.reduceMotion()),
                stored.get("timeFormat") instanceof String value && Set.of("12h", "24h").contains(value)
                        ? TimeFormat.parse(value) : DEFAULTS.timeFormat());
    }

    Map<String, Object> toJson() {
        Map<String, Object> json = new HashMap<>();
        json.put("darkMap", darkMap);
        json.put("distanceUnit", distanceUnit.name());
        json.put("defaultShareHours", defaultShareHours);
        json.put("mapStyle", mapStyle.name());
        json.put("chatDefault", chatDefault);
        json.put("reduceMotion", reduceMotion);
        json.put("timeFormat", timeFormat.value());
        return json;
    }

    private static boolean bool(Map<String, Object> stored, String key, boolean fallback) {
        return stored.get(key) instanceof Boolean value ? value : fallback;
    }

    private static <E extends Enum<E>> E choice(Map<String, Object> stored, String key, Class<E> type, E fallback) {
        if (stored.get(key) instanceof String value) {
            try {
                return Enum.valueOf(type, value.toLowerCase(Locale.ROOT));
            } catch (IllegalArgumentException e) {
                // Unknown value: keep the default.
            }
        }
        return fallback;
    }
}
