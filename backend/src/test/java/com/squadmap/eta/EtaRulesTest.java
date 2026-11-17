package com.squadmap.eta;

import com.squadmap.eta.domain.Eta;
import com.squadmap.eta.domain.TravelMode;
import com.squadmap.eta.service.EtaRules;
import com.squadmap.location.domain.Position;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/** How a member's travel mode is decided, and when a new route is worth asking Mapbox for. */
class EtaRulesTest {

    private static final Instant NOW = Instant.parse("2026-11-18T10:00:00Z");

    private static Position at(double lat, double lng) {
        return new Position(lat, lng, 8, 0.0, null, NOW);
    }

    private static Eta lastEta(TravelMode mode, double lat, double lng, Instant at) {
        return new Eta(UUID.randomUUID(), 2000, 300, mode, null, 0, false, at, lat, lng, 2000);
    }

    @Test
    void theirOwnChoiceAlwaysWins() {
        Eta guessed = lastEta(TravelMode.car, 18.58, 73.90, NOW);
        assertThat(EtaRules.modeOf("walk", guessed, 18_000)).isEqualTo(TravelMode.walk);
        assertThat(EtaRules.modeOf("bike", null, 500)).isEqualTo(TravelMode.bike);
    }

    @Test
    void beforeTheyChooseItIsACarBeyondTwoKilometresAndWalkingNearer() {
        // Standing still at the start (speed 0) no longer counts as walking.
        assertThat(EtaRules.modeOf(null, null, 18_000)).isEqualTo(TravelMode.car);
        assertThat(EtaRules.modeOf(null, null, 900)).isEqualTo(TravelMode.walk);
    }

    @Test
    void theFirstGuessStaysForTheWholeTrip() {
        // Set off by car from 18 km; now 1.5 km away, still by car.
        Eta byCar = lastEta(TravelMode.car, 18.58, 73.90, NOW.minusSeconds(60));
        assertThat(EtaRules.modeOf(null, byCar, 1_500)).isEqualTo(TravelMode.car);
    }

    @Test
    void anUnknownChoiceFallsBackToTheGuess() {
        assertThat(EtaRules.modeOf("rocket", null, 18_000)).isEqualTo(TravelMode.car);
    }

    @Test
    void carsAndBikesTakeTrafficAwareRoadRoutes() {
        assertThat(TravelMode.car.profile()).isEqualTo("driving-traffic");
        assertThat(TravelMode.bike.profile()).isEqualTo("driving-traffic");
        assertThat(TravelMode.walk.profile()).isEqualTo("walking");
    }

    @Test
    void aNewRouteIsWorthItAfter100MetresOrAMinuteOrAChangeOfMode() {
        Eta last = lastEta(TravelMode.car, 18.5800, 73.9000, NOW.minusSeconds(10));

        assertThat(EtaRules.worthRedoing(null, at(18.58, 73.90), TravelMode.car, NOW)).isTrue();
        assertThat(EtaRules.worthRedoing(last, at(18.5802, 73.9000), TravelMode.car, NOW)).isFalse();
        assertThat(EtaRules.worthRedoing(last, at(18.5810, 73.9000), TravelMode.car, NOW)).isTrue();
        assertThat(EtaRules.worthRedoing(last, at(18.5802, 73.9000), TravelMode.walk, NOW)).isTrue();
        assertThat(EtaRules.worthRedoing(last, at(18.5802, 73.9000), TravelMode.car, NOW.plusSeconds(50))).isTrue();
    }
}
