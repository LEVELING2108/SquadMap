package com.squadmap.user.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.id.UuidV7;
import com.squadmap.common.text.Text;
import com.squadmap.user.domain.User;
import com.squadmap.user.domain.UserSettings;
import com.squadmap.user.dto.UpdateSettingsRequest;
import com.squadmap.user.repo.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;

@Service
public class UserService {

    /** Avatar colors from the design system; each keeps white text readable. */
    public static final List<String> AVATAR_COLORS =
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
    public UserSettings updateSettings(UUID userId, UpdateSettingsRequest request) {
        Integer hours = request.defaultShareHours();
        if (hours != null && !UserSettings.SHARE_HOURS.contains(hours)) {
            throw invalidField("defaultShareHours", "Choose 1, 2, 4 or 8 hours.");
        }
        // Locked, so two changes sent at once (say, two switches flipped quickly) can't overwrite each other.
        User user = users.lockById(userId).filter(found -> !found.isDeleted()).orElseThrow(UserService::signedOut);
        UserSettings current = user.getSettings();
        UserSettings changed = new UserSettings(
                request.darkMap() != null ? request.darkMap() : current.darkMap(),
                request.distanceUnit() != null
                        ? UserSettings.DistanceUnit.valueOf(request.distanceUnit()) : current.distanceUnit(),
                hours != null ? hours : current.defaultShareHours(),
                request.mapStyle() != null ? UserSettings.MapStyle.valueOf(request.mapStyle()) : current.mapStyle(),
                request.chatDefault() != null ? request.chatDefault() : current.chatDefault(),
                request.reduceMotion() != null ? request.reduceMotion() : current.reduceMotion(),
                request.timeFormat() != null ? UserSettings.TimeFormat.parse(request.timeFormat()) : current.timeFormat());
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

    /**
     * Changes the name and/or colour; anything left null keeps its value. Trips already joined keep the
     * name the person had then: a trip member's name is a snapshot.
     *
     * @throws ApiException 400 {@code VALIDATION_FAILED} for an empty name or a colour not on the palette
     */
    @Transactional
    public User updateProfile(UUID userId, String newName, String newColor) {
        String name = newName == null ? null : Text.clean(newName);
        if (name != null && name.isEmpty()) {
            throw invalidField("name", "Enter your name.");
        }
        if (newColor != null && !AVATAR_COLORS.contains(newColor.toUpperCase(Locale.ROOT))) {
            throw invalidField("color", "Choose one of the colours shown.");
        }
        User user = users.findById(userId).filter(found -> !found.isDeleted()).orElseThrow(UserService::signedOut);
        user.changeProfile(name != null ? name : user.getName(),
                newColor != null ? newColor.toUpperCase(Locale.ROOT) : user.getColor(), clock.instant());
        return user;
    }

    /**
     * Moves the account to another email address.
     *
     * @param newEmail already normalised to lower case
     * @throws ApiException 409 {@code EMAIL_TAKEN} when another account uses it
     */
    @Transactional
    public User changeEmail(UUID userId, String newEmail) {
        User user = users.findById(userId).filter(found -> !found.isDeleted()).orElseThrow(UserService::signedOut);
        if (users.existsByEmail(newEmail)) {
            throw emailTaken();
        }
        user.changeEmail(newEmail, clock.instant());
        try {
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException e) {
            // Someone took the address between the check and the save; the unique index caught it.
            throw emailTaken();
        }
        return user;
    }

    private static ApiException invalidField(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "One or more fields are invalid.")
                .with("errors", List.of(Map.of("field", field, "message", message)));
    }

    private static ApiException emailTaken() {
        return new ApiException(HttpStatus.CONFLICT, ErrorCode.EMAIL_TAKEN,
                "This email already has an account. Log in instead.");
    }
}
