package com.squadmap.trip;

import com.squadmap.trip.service.TripCodes;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class TripCodesTest {

    @Test
    void theAlphabetHas31CharactersAndNoLookAlikes() {
        assertThat(TripCodes.ALPHABET).hasSize(31).doesNotContain("0", "O", "1", "I", "L");
        assertThat(TripCodes.ALPHABET.chars().distinct().count()).isEqualTo(31);
    }

    @Test
    void codesAreEightCharactersFromTheAlphabet() {
        for (int i = 0; i < 1_000; i++) {
            String code = TripCodes.generate();
            assertThat(code).hasSize(8).matches("[" + TripCodes.ALPHABET + "]{8}");
        }
    }

    @Test
    void codesDoNotRepeatInPractice() {
        Set<String> codes = new HashSet<>();
        for (int i = 0; i < 10_000; i++) {
            codes.add(TripCodes.generate());
        }
        assertThat(codes).hasSize(10_000);
    }

    @Test
    void typedCodesAreTidied() {
        assertThat(TripCodes.normalize(" k7qx-2p9t ")).isEqualTo("K7QX2P9T");
        assertThat(TripCodes.normalize("K7QX 2P9T")).isEqualTo("K7QX2P9T");
    }

    @Test
    void impossibleCodesAreRejected() {
        assertThat(TripCodes.normalize("K7QX2P9")).isNull();
        assertThat(TripCodes.normalize("K7QX2P9TT")).isNull();
        assertThat(TripCodes.normalize("K7QX2P0T")).as("0 is not in the alphabet").isNull();
        assertThat(TripCodes.normalize("K7QX2POT")).as("O is not in the alphabet").isNull();
        assertThat(TripCodes.normalize(null)).isNull();
    }
}
