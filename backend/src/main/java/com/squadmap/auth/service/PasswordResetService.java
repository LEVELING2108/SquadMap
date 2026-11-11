package com.squadmap.auth.service;

import com.squadmap.auth.domain.PasswordResetToken;
import com.squadmap.auth.repo.PasswordResetTokenRepository;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.id.UuidV7;
import com.squadmap.common.security.SecureTokens;
import com.squadmap.common.text.Text;
import com.squadmap.notify.mail.EmailSender;
import com.squadmap.user.domain.User;
import com.squadmap.user.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.util.HtmlUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * "Forgot password": emails a single-use link that is valid for 30 minutes. Requesting a new
 * link cancels older ones, and using a link signs the account out everywhere.
 */
@Service
public class PasswordResetService {

    static final Duration LINK_TTL = Duration.ofMinutes(30);
    private static final Logger log = LoggerFactory.getLogger(PasswordResetService.class);

    private final PasswordResetTokenRepository tokens;
    private final UserService users;
    private final RefreshTokenService refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final EmailSender email;
    private final TransactionTemplate transaction;
    private final Clock clock;

    public PasswordResetService(PasswordResetTokenRepository tokens, UserService users,
                                RefreshTokenService refreshTokens, PasswordEncoder passwordEncoder,
                                EmailSender email, TransactionTemplate transaction, Clock clock) {
        this.tokens = tokens;
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.email = email;
        this.transaction = transaction;
        this.clock = clock;
    }

    /**
     * Runs after the response has been sent, so the caller cannot tell from the answer or its
     * timing whether the email belongs to an account. Failures are logged, never returned.
     */
    @Async
    public void requestLink(String rawEmail) {
        try {
            String address = Text.normalizeEmail(rawEmail);
            Optional<User> user = users.findActiveByEmail(address);
            if (user.isEmpty()) {
                return;
            }
            String token = transaction.execute(status -> createLink(user.get().getId()));
            sendLink(user.get(), token);
            log.info("Password reset link sent for user {}", user.get().getId());
        } catch (RuntimeException e) {
            log.error("Could not send a password reset link: {}", e.getClass().getName());
        }
    }

    /**
     * Sets a new password with a link token, then signs the account out on every device.
     *
     * @throws ApiException 400 {@code RESET_LINK_INVALID} when the link is unknown, used or expired
     */
    @Transactional
    public void resetPassword(String rawToken, String newPassword) {
        Instant now = clock.instant();
        PasswordResetToken token = Optional.ofNullable(rawToken)
                .filter(value -> !value.isBlank())
                .flatMap(value -> tokens.findByTokenHash(SecureTokens.hash(value)))
                .filter(found -> found.isUsable(now))
                .orElseThrow(PasswordResetService::linkInvalid);

        token.markUsed(now);
        if (!users.changePasswordHash(token.getUserId(), passwordEncoder.encode(newPassword))) {
            throw linkInvalid();
        }
        tokens.cancelOpenLinks(token.getUserId(), now);
        refreshTokens.endAllSessions(token.getUserId());
        log.info("Password reset completed for user {}", token.getUserId());
    }

    @Scheduled(cron = "0 23 * * * *", zone = "UTC")
    @Transactional
    public int purgeExpired() {
        return tokens.deleteExpiredBefore(clock.instant());
    }

    private String createLink(UUID userId) {
        Instant now = clock.instant();
        tokens.cancelOpenLinks(userId, now);
        String raw = SecureTokens.generate();
        tokens.save(new PasswordResetToken(UuidV7.generate(clock), userId, SecureTokens.hash(raw), now,
                now.plus(LINK_TTL)));
        return raw;
    }

    private void sendLink(User user, String token) {
        // The token goes after "#": browsers never send that part to a server, so it stays out of
        // access logs and Referer headers. The web app reads it from the address bar.
        String link = email.webBaseUrl() + "/reset-password#token=" + token;
        String name = user.getName();
        String minutes = String.valueOf(LINK_TTL.toMinutes());

        String text = """
                Hi %s,

                Someone asked to reset the password for your SquadMap account.
                Open this link to choose a new one. It works once, for %s minutes:

                %s

                If this wasn't you, ignore this email. Your password stays the same.

                SquadMap
                """.formatted(name, minutes, link);

        String html = """
                <!doctype html>
                <html lang="en"><body style="margin:0;padding:24px;background:#FFF6E5;font-family:Arial,sans-serif;color:#12263A">
                <div style="max-width:480px;margin:0 auto;background:#FFFFFF;border-radius:20px;padding:28px">
                <h1 style="margin:0 0 12px;font-size:22px">Reset your password</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:21px">Hi %s, someone asked to reset the password for your SquadMap account. The button works once, for %s minutes.</p>
                <p style="margin:0 0 20px"><a href="%s" style="display:inline-block;background:#1A73E8;color:#FFFFFF;text-decoration:none;font-weight:bold;padding:14px 22px;border-radius:16px">Choose a new password</a></p>
                <p style="margin:0;font-size:13px;line-height:18px;color:#566B7F">If this wasn't you, ignore this email. Your password stays the same.</p>
                </div></body></html>
                """.formatted(HtmlUtils.htmlEscape(name), minutes, HtmlUtils.htmlEscape(link));

        email.send(user.getEmail(), "Reset your SquadMap password", text, html);
    }

    private static ApiException linkInvalid() {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.RESET_LINK_INVALID,
                "This reset link has expired or was already used. Request a new one.");
    }
}
