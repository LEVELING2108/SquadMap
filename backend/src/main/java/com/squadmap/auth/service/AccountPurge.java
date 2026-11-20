package com.squadmap.auth.service;

import com.squadmap.user.domain.User;
import com.squadmap.user.repo.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Every day, removes the personal data of accounts closed more than {@value AccountService#DELETE_AFTER_DAYS}
 * days ago. Each account goes in its own transaction, one step per table, and the log holds counts only.
 *
 * <p>What stays: an anonymous account row, so trips the person hosted keep a host in friends' history,
 * and their place on those trips under the name "Former member", with their consent records (proof that
 * sharing was agreed). Everything else that was theirs is deleted.
 */
@Component
public class AccountPurge {

    static final String FORMER_MEMBER = "Former member";
    private static final Logger log = LoggerFactory.getLogger(AccountPurge.class);

    private final UserRepository users;
    private final JdbcTemplate jdbc;
    private final TransactionTemplate transactions;
    private final Clock clock;
    private final boolean dryRun;

    public AccountPurge(UserRepository users, JdbcTemplate jdbc, TransactionTemplate transactions, Clock clock,
                        @Value("${squadmap.accounts.purge-dry-run:false}") boolean dryRun) {
        this.users = users;
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.clock = clock;
        this.dryRun = dryRun;
    }

    /** @return how many accounts were removed (or would be, in a dry run) */
    @Scheduled(cron = "0 23 3 * * *", zone = "UTC")
    public int purgeClosedAccounts() {
        Instant cutoff = clock.instant().minus(Duration.ofDays(AccountService.DELETE_AFTER_DAYS));
        List<UUID> due = jdbc.queryForList(
                "SELECT id FROM users WHERE deleted_at < ? AND purged_at IS NULL ORDER BY deleted_at",
                UUID.class, Timestamp.from(cutoff));
        if (dryRun) {
            log.info("Dry run: {} closed accounts are due for removal", due.size());
            return due.size();
        }
        int done = 0;
        for (UUID userId : due) {
            try {
                transactions.executeWithoutResult(status -> purge(userId, cutoff));
                done++;
            } catch (RuntimeException e) {
                log.error("Could not remove a closed account: {}", e.getClass().getName());
            }
        }
        if (!due.isEmpty()) {
            log.info("Removed the data of {} of {} closed accounts", done, due.size());
        }
        return done;
    }

    private void purge(UUID userId, Instant cutoff) {
        User user = users.lockById(userId).orElse(null);
        // Signed in again meanwhile, or already done by another instance.
        if (user == null || user.getDeletedAt() == null || !user.getDeletedAt().isBefore(cutoff) || user.isPurged()) {
            return;
        }
        jdbc.update("UPDATE trip_members SET display_name = ?, user_id = NULL WHERE user_id = ?", FORMER_MEMBER, userId);
        // Friends' alerts about this person ("Aman joined") are at most 30 days old when the account closes
        // and alerts are deleted at 30 days, so none are left by now.
        jdbc.update("DELETE FROM alerts WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM push_subscriptions WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM refresh_tokens WHERE user_id = ?", userId);
        jdbc.update("DELETE FROM password_reset_tokens WHERE user_id = ?", userId);
        user.purge(clock.instant());
    }
}
