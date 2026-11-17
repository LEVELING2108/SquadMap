package com.squadmap.eta;

import com.squadmap.eta.domain.Eta;
import com.squadmap.eta.domain.TravelMode;
import com.squadmap.eta.service.EtaRules;
import com.squadmap.location.domain.Position;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** How a member's travel mode is judged, and when a new route is worth asking Mapbox for. */
class EtaRulesTest {

    private static final Instant NOW = Instant.parse("2026-11-18T10:00:00Z");

    private static Position at(double lat, double lng, Double speed) {
        return new Position(lat, lng, 8, speed, null, NOW);
    }

    private static Eta lastEta(TravelMode mode, double lat, double lng, Instant at) {
        return new Eta(UUID.randomUUID(), 2000, 300, mode, null, 0, false, at, lat, lng, 2000);
    }

    @Test
    void thePhonesSpeedDecidesTheMode() {
        assertThat(EtaRules.modeOf(at(18.58, 73.90, 1.2), null, NOW)).isEqualTo(TravelMode.walking);
        assertThat(EtaRules.modeOf(at(18.58, 73.90, 9.0), null, NOW)).isEqualTo(TravelMode.driving);
    }

    @Test
    void withoutASpeedTheAverageSinceTheLastEtaDecides() {
        // About 110 m in 60 seconds: under 2 m/s.
        Eta last = lastEta(TravelMode.driving, 18.5800, 73.9000, NOW.minusSeconds(60));
        assertThat(EtaRules.modeOf(at(18.5810, 73.9000, null), last, NOW)).isEqualTo(TravelMode.walking);
    }

    @Test
    void withNothingToGoOnTheLastModeStays() {
        Eta last = lastEta(TravelMode.walking, 18.58, 73.90, NOW.minusSeconds(3));
        assertThat(EtaRules.modeOf(at(18.58, 73.90, null), last, NOW)).isEqualTo(TravelMode.walking);
        assertThat(EtaRules.modeOf(at(18.58, 73.90, null), null, NOW)).isEqualTo(TravelMode.driving);
    }

    @Test
    void aNewRouteIsWorthItAfter100MetresOrAMinuteOrAChangeOfMode() {
        Eta last = lastEta(TravelMode.driving, 18.5800, 73.9000, NOW.minusSeconds(10));

        assertThat(EtaRules.worthRedoing(null, at(18.58, 73.90, null), TravelMode.driving, NOW)).isTrue();
        assertThat(EtaRules.worthRedoing(last, at(18.5802, 73.9000, null), TravelMode.driving, NOW)).isFalse();
        assertThat(EtaRules.worthRedoing(last, at(18.5810, 73.9000, null), TravelMode.driving, NOW)).isTrue();
        assertThat(EtaRules.worthRedoing(last, at(18.5802, 73.9000, null), TravelMode.walking, NOW)).isTrue();
        assertThat(EtaRules.worthRedoing(last, at(18.5802, 73.9000, null), TravelMode.driving,
                NOW.plusSeconds(50))).isTrue();
    }
}
