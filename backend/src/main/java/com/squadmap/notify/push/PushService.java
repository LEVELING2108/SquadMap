package com.squadmap.notify.push;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.id.UuidV7;
import com.squadmap.common.metrics.AppMetrics;
import com.squadmap.notify.alert.AlertKind;
import com.squadmap.notify.alert.AlertSaved;
import com.squadmap.user.domain.UserSettings;
import com.squadmap.user.service.UserService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.interfaces.ECPublicKey;
import java.time.Clock;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Push notifications: the devices each account turned them on for, and sending an alert to them.
 * Guests have no alerts, so they have no push either.
 */
@Service
public class PushService {

    /** Each account keeps at most this many devices; a new one replaces the oldest. */
    static final int MAX_DEVICES = 10;
    /** A warning about sharing ending is no use after it has ended. */
    static final Duration ENDING_SOON_TTL = Duration.ofMinutes(10);
    static final Duration DEFAULT_TTL = Duration.ofDays(1);

    private static final Logger log = LoggerFactory.getLogger(PushService.class);

    private final PushSubscriptionRepository subscriptions;
    private final PushSender sender;
    private final UserService users;
    private final ObjectMapper json;
    private final AppMetrics metrics;
    private final Clock clock;

    public PushService(PushSubscriptionRepository subscriptions, PushSender sender, UserService users,
                       ObjectMapper json, AppMetrics metrics, Clock clock) {
        this.metrics = metrics;
        this.subscriptions = subscriptions;
        this.sender = sender;
        this.users = users;
        this.json = json;
        this.clock = clock;
    }

    /**
     * Turns push on for this device. Sending the same device again is fine; a device last used by another
     * account now belongs to this one.
     *
     * @throws ApiException 400 {@code VALIDATION_FAILED} for an address that isn't a known push service, or
     *                      keys that can't be used
     */
    @Transactional
    public void subscribe(UUID userId, SubscribeRequest request) {
        if (!sender.allowed(request.endpoint())) {
            throw invalid("endpoint", "This isn't a push service address.");
        }
        if (!usableKeys(request.keys())) {
            throw invalid("keys", "These keys can't be used for push messages.");
        }
        subscriptions.findByEndpoint(request.endpoint()).ifPresentOrElse(
                found -> found.renew(userId, request.keys().p256dh(), request.keys().auth(), clock.instant()),
                () -> subscriptions.save(new PushSubscription(UuidV7.generate(clock), userId, request.endpoint(),
                        request.keys().p256dh(), request.keys().auth(), clock.instant())));
        subscriptions.flush();
        List<PushSubscription> devices = subscriptions.findByUserIdOrderByCreatedAtAscIdAsc(userId);
        for (int i = 0; i < devices.size() - MAX_DEVICES; i++) {
            subscriptions.delete(devices.get(i));
        }
    }

    /** Turns push off on every device of the account: it is being deleted. */
    @Transactional
    public int forgetAllDevices(UUID userId) {
        List<PushSubscription> devices = subscriptions.findByUserIdOrderByCreatedAtAscIdAsc(userId);
        subscriptions.deleteAll(devices);
        return devices.size();
    }

    /** Turns push off for this device. Nothing happens if the account had no such device. */
    @Transactional
    public void unsubscribe(UUID userId, String endpoint) {
        subscriptions.deleteByUserIdAndEndpoint(userId, endpoint);
    }

    /**
     * Sends a saved alert to the account's devices, if the person wants this kind pushed. Runs after the
     * alert is committed, away from the request that caused it.
     */
    public void send(AlertSaved alert) {
        List<PushSubscription> devices = subscriptions.findByUserIdOrderByCreatedAtAscIdAsc(alert.userId());
        if (devices.isEmpty() || !wanted(alert.userId(), alert.kind())) {
            return;
        }
        byte[] body = body(alert);
        boolean endingSoon = alert.kind() == AlertKind.ending_soon;
        Duration ttl = endingSoon ? ENDING_SOON_TTL : DEFAULT_TTL;
        PushSender.Urgency urgency = endingSoon ? PushSender.Urgency.high : PushSender.Urgency.normal;
        int gone = 0;
        for (PushSubscription device : devices) {
            PushSender.Outcome outcome = sender.send(device, body, ttl, urgency);
            metrics.push(outcome.name());
            if (outcome == PushSender.Outcome.GONE) {
                subscriptions.deleteNow(device.getId());
                gone++;
            }
        }
        if (gone > 0) {
            log.info("Removed {} push subscriptions the push service no longer knows", gone);
        }
    }

    private boolean wanted(UUID userId, AlertKind kind) {
        UserSettings settings;
        try {
            settings = users.settingsOf(userId);
        } catch (ApiException e) {
            // The account was deleted meanwhile.
            return false;
        }
        return switch (kind) {
            case member_joined -> settings.pushJoined();
            case member_left -> settings.pushLeft();
            case ending_soon -> settings.pushEndingSoon();
            case trip_ended -> settings.pushTripEnded();
        };
    }

    /** What the service worker needs to word the notification and know where a tap leads. No places. */
    private byte[] body(AlertSaved alert) {
        Map<String, Object> message = new LinkedHashMap<>();
        message.put("alertId", alert.alertId());
        message.put("kind", alert.kind());
        message.put("tripId", alert.tripId());
        message.put("tripName", alert.tripName());
        message.put("actorName", alert.actorName());
        try {
            return json.writeValueAsString(message).getBytes(StandardCharsets.UTF_8);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not write the push message", e);
        }
    }

    private static boolean usableKeys(SubscribeRequest.Keys keys) {
        try {
            ECPublicKey key = EcKeys.publicKey(EcKeys.unbase64(keys.p256dh()));
            return key != null && EcKeys.unbase64(keys.auth()).length == 16;
        } catch (IllegalArgumentException e) {
            return false;
        }
    }

    private static ApiException invalid(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "One or more fields are invalid.")
                .with("errors", List.of(Map.of("field", field, "message", message)));
    }
}
