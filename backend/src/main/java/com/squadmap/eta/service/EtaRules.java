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
    /** Until someone says how they travel, further than this from the destination is taken as by car. */
    static final double CAR_BEYOND_M = 2_000;

    private EtaRules() {
    }

    /**
     * The member's own choice; before they choose, the guess made for their first ETA, kept so it never
     * flips mid-trip; for the first ETA, by car beyond 2 km and on foot nearer. Speed is not used: standing
     * still at the start (waiting for a cab, say) would look like walking.
     */
    public static TravelMode modeOf(String chosen, Eta previous, double straightMetres) {
        if (chosen != null) {
            try {
                return TravelMode.valueOf(chosen);
            } catch (IllegalArgumentException unknown) {
                // A value this version doesn't know: fall through to the guess.
            }
        }
        if (previous != null) {
            return previous.mode();
        }
        return straightMetres > CAR_BEYOND_M ? TravelMode.car : TravelMode.walk;
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
