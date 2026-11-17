package com.squadmap.eta.service;

import com.squadmap.common.geo.GeoMath;
import com.squadmap.eta.domain.Eta;
import com.squadmap.eta.domain.TravelMode;
import com.squadmap.location.domain.Position;

import java.time.Duration;
import java.time.Instant;

/** The judgement calls behind an ETA: how someone is travelling, and when a new route is worth paying for. */
public final class EtaRules {

    /** A new route is asked for after moving this far... */
    static final double REDO_AFTER_M = 100;
    /** ...or after this long, whichever comes first. */
    static final Duration REDO_AFTER = Duration.ofSeconds(60);
    /** Slower than this counts as walking. */
    static final double WALKING_BELOW_MPS = 2.5;

    private EtaRules() {
    }

    /** From the phone's speed, or the average since the last ETA; with neither, the last mode stays. */
    public static TravelMode modeOf(Position position, Eta previous, Instant now) {
        Double speed = position.speed();
        if (speed == null && previous != null) {
            double seconds = Duration.between(previous.computedAt(), now).toMillis() / 1000.0;
            if (seconds >= 10) {
                speed = GeoMath.metres(previous.fromLat(), previous.fromLng(), position.lat(), position.lng()) / seconds;
            }
        }
        if (speed == null) {
            return previous == null ? TravelMode.driving : previous.mode();
        }
        return speed < WALKING_BELOW_MPS ? TravelMode.walking : TravelMode.driving;
    }

    /** True for the first ETA, a change of mode, 100 m moved, or a minute passed. */
    public static boolean worthRedoing(Eta previous, Position position, TravelMode mode, Instant now) {
        if (previous == null || previous.mode() != mode) {
            return true;
        }
        double moved = GeoMath.metres(previous.fromLat(), previous.fromLng(), position.lat(), position.lng());
        return moved >= REDO_AFTER_M || Duration.between(previous.computedAt(), now).compareTo(REDO_AFTER) >= 0;
    }
}
