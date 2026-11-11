package com.squadmap.common.text;

import java.util.Locale;

/** Normalises text typed by people before it is validated or stored. */
public final class Text {

    private Text() {
    }

    /** Removes control characters (including line breaks) and surrounding whitespace. */
    public static String clean(String value) {
        if (value == null) {
            return null;
        }
        return value.replaceAll("\\p{Cntrl}", "").strip();
    }

    /** Emails are compared and stored trimmed and lower-case. */
    public static String normalizeEmail(String value) {
        if (value == null) {
            return null;
        }
        return value.strip().toLowerCase(Locale.ROOT);
    }
}
