package com.squadmap.auth.service;

import com.squadmap.auth.repo.PasswordResetTokenRepository;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.common.text.Text;
import com.squadmap.user.domain.User;
import com.squadmap.user.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import com.squadmap.notify.push.PushService;
import com.squadmap.trip.service.TripLifecycleService;

/**
 * Changes a signed-in person makes to their own account's security: password, email, and other
 * devices' sessions. Each change that matters is confirmed with the current password.
 */
@Service
public class AccountService {

    /** How long a closed account waits before its data is removed: the time to change one's mind. */
    public static final int DELETE_AFTER_DAYS = 30;

    private static final Logger log = LoggerFactory.getLogger(AccountService.class);

    private final UserService users;
    private final PasswordEncoder passwordEncoder;
    private final RefreshTokenService refreshTokens;
    private final PasswordResetTokenRepository resetLinks;
    private final RateLimiter rateLimiter;
    private final AccountNotices notices;
    private final TripLifecycleService trips;
    private final PushService push;
    private final Clock clock;

    public AccountService(UserService users, PasswordEncoder passwordEncoder, RefreshTokenService refreshTokens,
                          PasswordResetTokenRepository resetLinks, RateLimiter rateLimiter, AccountNotices notices,
                          TripLifecycleService trips, PushService push, Clock clock) {
        this.trips = trips;
        this.push = push;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.refreshTokens = refreshTokens;
        this.resetLinks = resetLinks;
        this.rateLimiter = rateLimiter;
        this.notices = notices;
        this.clock = clock;
    }

    /**
     * Sets a new password and ends every other session; the one making the change stays signed in.
     *
     * @param currentSession the refresh cookie of this device, if it sent one
     */
    @Transactional
    public void changePassword(UUID userId, String currentPassword, String newPassword, String currentSession) {
        User user = activeUser(userId);
        requireCurrentPassword(user, currentPassword, "currentPassword");
        if (passwordEncoder.matches(newPassword, user.getPasswordHash())) {
            throw invalidField("newPassword", "Choose a password you haven't been using.");
        }
        users.changePasswordHash(userId, passwordEncoder.encode(newPassword));
        // Any reset link already emailed would undo this change, so it stops working too.
        resetLinks.cancelOpenLinks(userId, clock.instant());
        endOthers(userId, currentSession);
        log.info("Password changed for user {}; other sessions ended", userId);
    }

    /**
     * Moves the account to a new email address and tells the old one.
     *
     * @throws ApiException 409 {@code EMAIL_TAKEN} when another account uses the address
     */
    @Transactional
    public User changeEmail(UUID userId, String newEmail, String password) {
        User user = activeUser(userId);
        requireCurrentPassword(user, password, "password");
        String address = Text.normalizeEmail(newEmail);
        if (address.equals(user.getEmail())) {
            throw invalidField("email", "That's already your email address.");
        }
        String oldAddress = user.getEmail();
        User changed = users.changeEmail(userId, address);
        notices.emailChanged(userId, oldAddress, changed.getName(), address);
        log.info("Email changed for user {}", userId);
        return changed;
    }

    /**
     * Closes the account at the person's request. Straight away: trips they host end, they leave the
     * others, every session ends and push stops. Their data is removed after {@value #DELETE_AFTER_DAYS}
     * days unless they sign in again before then (see AccountPurge).
     *
     * @return when the data will be removed
     * @throws ApiException 400 {@code VALIDATION_FAILED} for a wrong password; 429 after too many
     */
    @Transactional
    public Instant deleteAccount(UUID userId, String password) {
        User user = activeUser(userId);
        requireCurrentPassword(user, password, "password");
        int trips = this.trips.leaveEverything(userId);
        users.markDeleted(userId);
        refreshTokens.endAllSessions(userId);
        push.forgetAllDevices(userId);
        resetLinks.cancelOpenLinks(userId, clock.instant());
        Instant removeAt = clock.instant().plus(Duration.ofDays(DELETE_AFTER_DAYS));
        notices.deletionScheduled(userId, user.getEmail(), user.getName(),
                DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH).withZone(ZoneOffset.UTC).format(removeAt));
        log.info("Account {} closed at its owner's request; left or ended {} live trips", userId, trips);
        return removeAt;
    }

    /** Signs the account out on every other device. */
    @Transactional
    public void endOtherSessions(UUID userId, String currentSession) {
        activeUser(userId);
        endOthers(userId, currentSession);
        log.info("Ended the other sessions of user {}", userId);
    }

    /** @return how many stored tokens were revoked (not devices: a session keeps its used tokens) */
    private int endOthers(UUID userId, String currentSession) {
        Optional<UUID> keep = refreshTokens.familyOf(currentSession, userId);
        return keep.map(family -> refreshTokens.endSessionsExcept(userId, family))
                .orElseGet(() -> refreshTokens.endAllSessions(userId));
    }

    /**
     * Checks the password, counting each try against a small allowance, so a borrowed signed-in device
     * can't be used to guess it. Only wrong answers use up the allowance.
     */
    private void requireCurrentPassword(User user, String password, String field) {
        String key = user.getId().toString();
        rateLimiter.checkNotLockedOut(RateLimit.PASSWORD_CHECK_PER_ACCOUNT, key);
        if (password == null || !passwordEncoder.matches(password, user.getPasswordHash())) {
            rateLimiter.record(RateLimit.PASSWORD_CHECK_PER_ACCOUNT, key);
            throw invalidField(field, "That isn't your current password.");
        }
    }

    private User activeUser(UUID userId) {
        return users.findActiveById(userId).orElseThrow(() -> new ApiException(
                HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Sign in to continue."));
    }

    private static ApiException invalidField(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "One or more fields are invalid.")
                .with("errors", List.of(Map.of("field", field, "message", message)));
    }
}
