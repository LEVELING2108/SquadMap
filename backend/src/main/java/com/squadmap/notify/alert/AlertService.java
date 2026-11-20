package com.squadmap.notify.alert;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.id.UuidV7;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Limit;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * The in-app inbox. Other features report what happened; this keeps it for the people it concerns, for
 * {@value #KEEP_DAYS} days. Alerts are only for accounts: a guest has no inbox to come back to.
 */
@Service
public class AlertService {

    static final int KEEP_DAYS = 30;
    static final int MAX_PAGE = 50;
    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    private final AlertRepository alerts;
    private final ApplicationEventPublisher events;
    private final Clock clock;

    public AlertService(AlertRepository alerts, ApplicationEventPublisher events, Clock clock) {
        this.alerts = alerts;
        this.events = events;
        this.clock = clock;
    }

    /** The host hears that someone joined. */
    @Transactional
    public void memberJoined(UUID hostId, UUID tripId, String tripName, String name, String color) {
        save(hostId, AlertKind.member_joined, tripId, tripName, name, color);
    }

    /** The host hears that someone left. */
    @Transactional
    public void memberLeft(UUID hostId, UUID tripId, String tripName, String name, String color) {
        save(hostId, AlertKind.member_left, tripId, tripName, name, color);
    }

    /** The host is warned that sharing ends soon, with time to extend. */
    @Transactional
    public void endingSoon(UUID hostId, UUID tripId, String tripName) {
        save(hostId, AlertKind.ending_soon, tripId, tripName, null, null);
    }

    /** Everyone given hears that the trip is over. */
    @Transactional
    public void tripEnded(Collection<UUID> userIds, UUID tripId, String tripName) {
        for (UUID userId : new HashSet<>(userIds)) {
            save(userId, AlertKind.trip_ended, tripId, tripName, null, null);
        }
    }

    /** A page of the account's alerts, newest first, with how many are unread in all. */
    @Transactional(readOnly = true)
    public AlertPage page(UUID userId, UUID before, int limit) {
        int size = Math.clamp(limit, 1, MAX_PAGE);
        List<Alert> found = before == null
                ? alerts.findNewestFor(userId, Limit.of(size + 1))
                : alerts.findOlderFor(userId, before, Limit.of(size + 1));
        List<Alert> page = found.size() > size ? found.subList(0, size) : found;
        Set<UUID> live = page.isEmpty() ? Set.of()
                : new HashSet<>(alerts.liveTripsAmong(
                        page.stream().map(Alert::getTripId).distinct().toList(), clock.instant()));
        List<AlertResponse> items = page.stream()
                .map(alert -> AlertResponse.of(alert, live.contains(alert.getTripId())))
                .toList();
        UUID next = found.size() > size ? page.get(page.size() - 1).getId() : null;
        return new AlertPage(items, next, alerts.countByUserIdAndReadAtIsNull(userId));
    }

    @Transactional(readOnly = true)
    public long unreadCount(UUID userId) {
        return alerts.countByUserIdAndReadAtIsNull(userId);
    }

    /**
     * Marks one of the account's alerts read.
     *
     * @throws ApiException 404 when the account has no such alert, whoever else might
     */
    @Transactional
    public void markRead(UUID userId, UUID alertId) {
        alerts.findByIdAndUserId(alertId, userId)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, ErrorCode.NOT_FOUND,
                        "There is no such alert."))
                .markRead(clock.instant());
    }

    @Transactional
    public int markAllRead(UUID userId) {
        return alerts.markAllRead(userId, clock.instant());
    }

    /** Every night, alerts older than {@value #KEEP_DAYS} days are deleted, names and all. */
    @Scheduled(cron = "0 41 2 * * *", zone = "UTC")
    @Transactional
    public int purgeOld() {
        int deleted = alerts.deleteOlderThan(clock.instant().minus(Duration.ofDays(KEEP_DAYS)));
        if (deleted > 0) {
            log.info("Deleted {} alerts older than {} days", deleted, KEEP_DAYS);
        }
        return deleted;
    }

    private void save(UUID userId, AlertKind kind, UUID tripId, String tripName, String actorName,
                      String actorColor) {
        if (userId == null) {
            return;
        }
        Alert alert = alerts.save(new Alert(UuidV7.generate(clock), userId, kind, tripId, tripName, actorName,
                actorColor, clock.instant()));
        events.publishEvent(new AlertSaved(alert.getId(), userId, kind, tripId, tripName, actorName));
    }
}
