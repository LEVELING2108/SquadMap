package com.squadmap.trip.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Duration;
import java.util.UUID;

/**
 * For people who turned "Keep trip history" off: their finished trips are unlinked from their account, so
 * they no longer appear in their history or stats and no distance stays with them. Friends keep their own
 * copy, with the name as it was on the trip.
 *
 * <p>It happens {@link #AFTER} after a trip ends (or after they left it), so Trip complete and the trip
 * chat still work in the hours right after.
 */
@Service
public class HistoryForgetting {

    static final Duration AFTER = Duration.ofHours(24);
    private static final Logger log = LoggerFactory.getLogger(HistoryForgetting.class);

    /** Places on trips that are over for that person: they left, or the trip ended or ran out. */
    private static final String FINISHED = """
            (m.left_at IS NOT NULL AND m.left_at < ?)
            OR (t.status <> 'active' AND COALESCE(t.ended_at, t.expires_at) < ?)
            OR t.expires_at < ?
            """;

    private final JdbcTemplate jdbc;
    private final Clock clock;

    public HistoryForgetting(JdbcTemplate jdbc, Clock clock) {
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Every hour: unlinks trips finished over a day ago, for everyone who keeps no history. */
    @Scheduled(cron = "0 7 * * * *", zone = "UTC")
    @Transactional
    public int forgetForEveryoneWhoAsked() {
        Timestamp cutoff = Timestamp.from(clock.instant().minus(AFTER));
        int forgotten = jdbc.update("""
                UPDATE trip_members m SET user_id = NULL, distance_m = NULL
                FROM trips t, users u
                WHERE t.id = m.trip_id AND u.id = m.user_id AND u.settings ->> 'keepHistory' = 'false'
                  AND (""" + FINISHED + ")", cutoff, cutoff, cutoff);
        if (forgotten > 0) {
            log.info("Removed {} finished trips from the history of people who keep none", forgotten);
        }
        return forgotten;
    }

    /**
     * "Remove past trips": unlinks every trip that is over for this account, now. Trips still running are
     * kept until they end.
     *
     * @return how many places on trips were unlinked
     */
    @Transactional
    public int forgetPastTrips(UUID userId) {
        Timestamp now = Timestamp.from(clock.instant());
        return jdbc.update("""
                UPDATE trip_members m SET user_id = NULL, distance_m = NULL
                FROM trips t
                WHERE t.id = m.trip_id AND m.user_id = ? AND (""" + FINISHED + ")", userId, now, now, now);
    }
}
