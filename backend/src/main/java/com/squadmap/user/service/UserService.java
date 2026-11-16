package com.squadmap.user.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.id.UuidV7;
import com.squadmap.user.domain.User;
import com.squadmap.user.domain.UserSettings;
import com.squadmap.user.repo.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class UserService {

    /** Avatar colors from the design system; each keeps white text readable. */
    private static final List<String> AVATAR_COLORS =
            List.of("#0F6E56", "#534AB7", "#993C1D", "#854F0B", "#993556");

    private final UserRepository users;
    private final Clock clock;

    public UserService(UserRepository users, Clock clock) {
        this.users = users;
        this.clock = clock;
    }

    /**
     * Creates an account. The email must already be normalised and the password already hashed.
     *
     * @throws ApiException 409 {@code EMAIL_TAKEN} when the email belongs to an existing account
     */
    @Transactional
    public User create(String name, String email, String passwordHash, String termsVersion) {
        if (users.existsByEmail(email)) {
            throw emailTaken();
        }
        String color = AVATAR_COLORS.get(ThreadLocalRandom.current().nextInt(AVATAR_COLORS.size()));
        User user = new User(UuidV7.generate(clock), email, passwordHash, name, color, termsVersion, clock.instant());
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Two sign-ups with the same email raced; the unique index let only one through.
            throw emailTaken();
        }
    }

    /** An account that can still be used: it exists and is not pending deletion. */
    @Transactional(readOnly = true)
    public Optional<User> findActiveByEmail(String email) {
        return users.findByEmail(email).filter(user -> !user.isDeleted());
    }

    @Transactional(readOnly = true)
    public Optional<User> findActiveById(UUID id) {
        return users.findById(id).filter(user -> !user.isDeleted());
    }

    @Transactional(readOnly = true)
    public UserSettings settingsOf(UUID userId) {
        return findActiveById(userId).map(User::getSettings).orElseThrow(UserService::signedOut);
    }

    /**
     * Applies the settings given; the rest keep their values.
     *
     * @throws ApiException 400 {@code VALIDATION_FAILED} for a sharing time trips don't offer
     */
    @Transactional
    public UserSettings updateSettings(UUID userId, Boolean darkMap, String distanceUnit, Integer defaultShareHours) {
        if (defaultShareHours != null && !UserSettings.SHARE_HOURS.contains(defaultShareHours)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "One or more fields are invalid.")
                    .with("errors", List.of(Map.of("field", "defaultShareHours", "message", "Choose 1, 2, 4 or 8 hours.")));
        }
        // Locked, so two changes sent at once (say, two switches flipped quickly) can't overwrite each other.
        User user = users.lockById(userId).filter(found -> !found.isDeleted()).orElseThrow(UserService::signedOut);
        UserSettings current = user.getSettings();
        UserSettings changed = new UserSettings(
                darkMap != null ? darkMap : current.darkMap(),
                distanceUnit != null ? UserSettings.DistanceUnit.valueOf(distanceUnit) : current.distanceUnit(),
                defaultShareHours != null ? defaultShareHours : current.defaultShareHours());
        user.changeSettings(changed, clock.instant());
        return changed;
    }

    /** A valid token for an account that no longer exists: treat as signed out. */
    private static ApiException signedOut() {
        return new ApiException(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Sign in to continue.");
    }

    /** Replaces the password hash of an active account. */
    @Transactional
    public boolean changePasswordHash(UUID userId, String newHash) {
        return users.findById(userId)
                .filter(user -> !user.isDeleted())
                .map(user -> {
                    user.changePasswordHash(newHash, clock.instant());
                    return true;
                })
                .orElse(false);
    }

    private static ApiException emailTaken() {
        return new ApiException(HttpStatus.CONFLICT, ErrorCode.EMAIL_TAKEN,
                "This email already has an account. Log in instead.");
    }
}
