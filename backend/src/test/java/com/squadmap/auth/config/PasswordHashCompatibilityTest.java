package com.squadmap.auth.config;

import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Stored password hashes must keep working when the hashing library is upgraded, or every
 * existing account would be locked out. These hashes were made by earlier versions and are kept
 * here as fixed samples; a new library version must verify them all.
 */
class PasswordHashCompatibilityTest {

    private static final String PASSWORD = "correct horse battery";

    /** Made by BouncyCastle 1.80 (Argon2id, 19 MiB, 2 passes, 1 thread) for a throwaway test account. */
    private static final String HASH_FROM_BOUNCYCASTLE_1_80 =
            "$argon2id$v=19$m=19456,t=2,p=1$aMGN5SbHVEq8O9pWJchpqQ$Yd1VdpAV51W6b/xjWiMIhOtipwuaB1ZgmvdNeacS6dA";

    private final PasswordEncoder encoder = new AuthConfig().passwordEncoder();

    @Test
    void hashesFromEarlierVersionsStillVerify() {
        assertThat(encoder.matches(PASSWORD, HASH_FROM_BOUNCYCASTLE_1_80)).isTrue();
    }

    @Test
    void theWrongPasswordDoesNotVerifyAgainstThem() {
        assertThat(encoder.matches("correct horse battery!", HASH_FROM_BOUNCYCASTLE_1_80)).isFalse();
    }

    @Test
    void newHashesUseTheSameAlgorithmAndSettings() {
        String hash = encoder.encode(PASSWORD);

        assertThat(hash).startsWith("$argon2id$v=19$m=19456,t=2,p=1$");
        assertThat(encoder.matches(PASSWORD, hash)).isTrue();
    }
}
