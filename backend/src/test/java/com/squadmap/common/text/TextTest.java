package com.squadmap.common.text;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TextTest {

    @Test
    void cleanRemovesControlCharactersAndSurroundingSpace() {
        assertThat(Text.clean("  Pri\u0000ya\r\n\t ")).isEqualTo("Priya");
    }

    @Test
    void cleanKeepsInnerSpacesAndNonLatinLetters() {
        assertThat(Text.clean(" प्रिया  शर्मा ")).isEqualTo("प्रिया  शर्मा");
    }

    @Test
    void normalizeEmailTrimsAndLowerCases() {
        assertThat(Text.normalizeEmail("  Priya@Example.COM ")).isEqualTo("priya@example.com");
    }

    @Test
    void normalizeEmailDoesNotDependOnTheServerLocale() {
        // In a Turkish locale, a plain toLowerCase() turns "I" into a dotless "ı".
        assertThat(Text.normalizeEmail("INFO@EXAMPLE.COM")).isEqualTo("info@example.com");
    }

    @Test
    void nullStaysNull() {
        assertThat(Text.clean(null)).isNull();
        assertThat(Text.normalizeEmail(null)).isNull();
    }
}
