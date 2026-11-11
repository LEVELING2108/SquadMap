package com.squadmap.common.id;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.UUID;

/**
 * Generates version 7 UUIDs (RFC 9562): the first 48 bits are the creation time in
 * milliseconds, the rest is random. Ids therefore sort by creation time, which keeps
 * primary-key indexes compact, while staying unguessable.
 */
public final class UuidV7 {

    private static final SecureRandom RANDOM = new SecureRandom();

    private UuidV7() {
    }

    public static UUID generate(Clock clock) {
        long millis = clock.millis();
        byte[] random = new byte[10];
        RANDOM.nextBytes(random);

        long high = (millis & 0xFFFF_FFFF_FFFFL) << 16;
        high |= 0x7000L;                                              // version 7
        high |= ((random[0] & 0x0FL) << 8) | (random[1] & 0xFFL);     // 12 random bits

        long low = 0x8000_0000_0000_0000L;                            // RFC variant
        low |= (random[2] & 0x3FL) << 56;
        for (int i = 3; i < 10; i++) {
            low |= (random[i] & 0xFFL) << (8 * (9 - i));
        }
        return new UUID(high, low);
    }
}
