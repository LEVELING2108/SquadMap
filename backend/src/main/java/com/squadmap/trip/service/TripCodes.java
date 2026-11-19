package com.squadmap.trip.service;

import java.security.SecureRandom;
import java.util.Locale;

/**
 * Trip codes: 8 characters from 31 that can't be mistaken for each other when read aloud or
 * typed from a screen (no 0, O, 1, I or L). That is 31^8, about 852 billion codes, so guessing
 * one is hopeless at the join rate limit.
 */
public final class TripCodes {

    public static final String ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
    public static final int LENGTH = 8;

    private static final SecureRandom RANDOM = new SecureRandom();

    private TripCodes() {
    }

    public static String generate() {
        StringBuilder code = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            code.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return code.toString();
    }

    /**
     * Tidies a code typed by a person: upper case, without spaces or dashes.
     *
     * @return the tidied code, or {@code null} when it cannot be a valid code
     */
    public static String normalize(String typed) {
        if (typed == null) {
            return null;
        }
        String code = typed.replaceAll("[\\s-]", "").toUpperCase(Locale.ROOT);
        if (code.length() != LENGTH) {
            return null;
        }
        for (int i = 0; i < code.length(); i++) {
            if (ALPHABET.indexOf(code.charAt(i)) < 0) {
                return null;
            }
        }
        return code;
    }
}
