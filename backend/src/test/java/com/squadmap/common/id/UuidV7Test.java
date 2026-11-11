package com.squadmap.common.id;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class UuidV7Test {

    private static Clock at(String instant) {
        return Clock.fixed(Instant.parse(instant), ZoneOffset.UTC);
    }

    @Test
    void isAVersion7UuidWithTheStandardVariant() {
        UUID id = UuidV7.generate(Clock.systemUTC());

        assertThat(id.version()).isEqualTo(7);
        assertThat(id.variant()).isEqualTo(2);
    }

    @Test
    void carriesTheCreationTimeInItsFirst48Bits() {
        Instant created = Instant.parse("2026-11-11T10:15:30.123Z");

        UUID id = UuidV7.generate(Clock.fixed(created, ZoneOffset.UTC));

        assertThat(id.getMostSignificantBits() >>> 16).isEqualTo(created.toEpochMilli());
    }

    @Test
    void laterIdsSortAfterEarlierOnes() {
        UUID earlier = UuidV7.generate(at("2026-11-11T10:00:00Z"));
        UUID later = UuidV7.generate(at("2026-11-11T10:00:01Z"));

        assertThat(earlier.toString()).isLessThan(later.toString());
    }

    @Test
    void idsCreatedInTheSameMillisecondAreStillUnique() {
        Clock frozen = at("2026-11-11T10:00:00Z");
        Set<UUID> ids = new HashSet<>();

        for (int i = 0; i < 10_000; i++) {
            ids.add(UuidV7.generate(frozen));
        }

        assertThat(ids).hasSize(10_000);
    }
}
