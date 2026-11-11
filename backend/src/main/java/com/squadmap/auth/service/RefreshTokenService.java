package com.squadmap.auth.service;

import com.squadmap.auth.config.AuthProperties;
import com.squadmap.auth.domain.RefreshToken;
import com.squadmap.auth.repo.RefreshTokenRepository;
import com.squadmap.common.id.UuidV7;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/**
 * Refresh tokens keep a person signed in. Each one works once: using it returns the next token
 * in the same family. If a token that was already used is presented again, someone holds a
 * copy, so every token in that family is revoked and the session ends for both holders.
 */
@Service
public class RefreshTokenService {

    private static final Logger log = LoggerFactory.getLogger(RefreshTokenService.class);
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int TOKEN_BYTES = 32;

    private final RefreshTokenRepository tokens;
    private final AuthProperties properties;
    private final Clock clock;

    public RefreshTokenService(RefreshTokenRepository tokens, AuthProperties properties, Clock clock) {
        this.tokens = tokens;
        this.properties = properties;
        this.clock = clock;
    }

    /** Starts a new session for a sign-in and returns its first token. */
    @Transactional
    public String startSession(UUID userId) {
        return issue(userId, UuidV7.generate(clock));
    }

    /**
     * Exchanges a token for the next one in its family.
     * Never throws for a bad token, so the revocation on reuse is committed rather than rolled back.
     */
    @Transactional
    public Rotation rotate(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return Rotation.REJECTED;
        }
        Optional<RefreshToken> found = tokens.findByTokenHash(hash(rawToken));
        if (found.isEmpty()) {
            return Rotation.REJECTED;
        }
        RefreshToken token = found.get();
        Instant now = clock.instant();

        if (token.isSpent()) {
            int revoked = tokens.revokeFamily(token.getFamilyId(), now);
            if (revoked > 0) {
                log.warn("Refresh token reuse detected; ended session {}", token.getFamilyId());
            }
            return Rotation.REJECTED;
        }
        if (token.isExpired(now)) {
            return Rotation.REJECTED;
        }

        token.markUsed(now);
        String next = issue(token.getUserId(), token.getFamilyId());
        return new Rotation(token.getUserId(), token.getFamilyId(), next);
    }

    /** Ends the session a token belongs to. Unknown tokens are ignored. */
    @Transactional
    public void endSession(String rawToken) {
        if (rawToken == null || rawToken.isBlank()) {
            return;
        }
        tokens.findByTokenHash(hash(rawToken))
                .ifPresent(token -> tokens.revokeFamily(token.getFamilyId(), clock.instant()));
    }

    @Transactional
    public void endSession(UUID familyId) {
        tokens.revokeFamily(familyId, clock.instant());
    }

    /** Deletes tokens that can no longer be used. Safe to run on several instances at once. */
    @Scheduled(cron = "0 17 * * * *", zone = "UTC")
    @Transactional
    public int purgeExpired() {
        int removed = tokens.deleteExpiredBefore(clock.instant());
        if (removed > 0) {
            log.info("Purged {} expired refresh tokens", removed);
        }
        return removed;
    }

    private String issue(UUID userId, UUID familyId) {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        String raw = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        Instant now = clock.instant();
        tokens.save(new RefreshToken(UuidV7.generate(clock), userId, familyId, hash(raw), now,
                now.plus(properties.refreshTokenTtl())));
        return raw;
    }

    private static String hash(String rawToken) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(rawToken.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }

    /**
     * The outcome of a refresh. When {@link #accepted()} is false, every other field is null.
     *
     * @param nextToken the replacement token to send back to the client
     */
    public record Rotation(UUID userId, UUID familyId, String nextToken) {

        static final Rotation REJECTED = new Rotation(null, null, null);

        public boolean accepted() {
            return nextToken != null;
        }

        @Override
        public String toString() {
            return "Rotation[accepted=" + accepted() + "]";
        }
    }
}
