package com.squadmap.user.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.user.domain.User;
import com.squadmap.user.dto.SettingsResponse;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * "Download my data": everything the app keeps about an account, in one JSON document. There are no
 * locations in it because none are kept: spots live in memory for minutes and only a total distance stays.
 */
@Service
public class DataExportService {

    private final UserService users;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public DataExportService(UserService users, JdbcTemplate jdbc, Clock clock) {
        this.users = users;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Map<String, Object> export(UUID userId) {
        User user = users.findActiveById(userId).orElseThrow(() -> new ApiException(
                HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Sign in to continue."));
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("exportedAt", clock.instant());
        data.put("about", "Everything SquadMap keeps about your account. Live locations are never stored, so "
                + "none are here; a trip keeps only how far you moved in total.");
        data.put("account", account(user));
        data.put("settings", SettingsResponse.from(user.getSettings()));
        data.put("trips", trips(userId));
        data.put("locationConsents", consents(userId));
        data.put("chatMessages", chatMessages(userId));
        data.put("alerts", alerts(userId));
        data.put("pushDevices", jdbc.queryForObject(
                "SELECT count(*) FROM push_subscriptions WHERE user_id = ?", Integer.class, userId));
        return data;
    }

    private static Map<String, Object> account(User user) {
        Map<String, Object> account = new LinkedHashMap<>();
        account.put("id", user.getId());
        account.put("name", user.getName());
        account.put("email", user.getEmail());
        account.put("color", user.getColor());
        account.put("createdAt", user.getCreatedAt());
        account.put("termsVersion", user.getTermsVersion());
        account.put("termsAcceptedAt", user.getTermsAcceptedAt());
        return account;
    }

    private List<Map<String, Object>> trips(UUID userId) {
        List<Map<String, Object>> trips = new ArrayList<>();
        jdbc.query("""
                SELECT t.id, t.name, t.dest_name, t.starts_at, t.expires_at, t.ended_at, t.status,
                       m.role, m.display_name, m.joined_at, m.left_at, m.arrived_at, m.distance_m, m.travel_mode,
                       (SELECT string_agg(o.display_name, ', ' ORDER BY o.joined_at) FROM trip_members o
                         WHERE o.trip_id = t.id AND (o.user_id IS NULL OR o.user_id <> ?)) AS friends
                FROM trip_members m JOIN trips t ON t.id = m.trip_id
                WHERE m.user_id = ?
                ORDER BY m.joined_at DESC
                """, row -> {
            Map<String, Object> trip = new LinkedHashMap<>();
            trip.put("tripId", row.getObject("id", UUID.class));
            trip.put("name", row.getString("name"));
            trip.put("destination", row.getString("dest_name"));
            trip.put("startedAt", instant(row.getTimestamp("starts_at")));
            trip.put("sharingUntil", instant(row.getTimestamp("expires_at")));
            trip.put("endedAt", instant(row.getTimestamp("ended_at")));
            trip.put("status", row.getString("status"));
            trip.put("yourRole", row.getString("role"));
            trip.put("yourNameOnTheTrip", row.getString("display_name"));
            trip.put("joinedAt", instant(row.getTimestamp("joined_at")));
            trip.put("leftAt", instant(row.getTimestamp("left_at")));
            trip.put("arrivedAt", instant(row.getTimestamp("arrived_at")));
            trip.put("distanceMetres", row.getObject("distance_m"));
            trip.put("travelMode", row.getString("travel_mode"));
            trip.put("friends", row.getString("friends"));
            trips.add(trip);
        }, userId, userId);
        return trips;
    }

    private List<Map<String, Object>> consents(UUID userId) {
        List<Map<String, Object>> consents = new ArrayList<>();
        jdbc.query("""
                SELECT c.policy_version, c.granted_at, c.withdrawn_at, t.name
                FROM consent_log c JOIN trip_members m ON m.id = c.trip_member_id JOIN trips t ON t.id = m.trip_id
                WHERE m.user_id = ?
                ORDER BY c.granted_at DESC
                """, row -> {
            Map<String, Object> consent = new LinkedHashMap<>();
            consent.put("trip", row.getString("name"));
            consent.put("policyVersion", row.getString("policy_version"));
            consent.put("grantedAt", instant(row.getTimestamp("granted_at")));
            consent.put("withdrawnAt", instant(row.getTimestamp("withdrawn_at")));
            consents.add(consent);
        }, userId);
        return consents;
    }

    private List<Map<String, Object>> chatMessages(UUID userId) {
        List<Map<String, Object>> messages = new ArrayList<>();
        jdbc.query("""
                SELECT c.body, c.created_at, t.name
                FROM chat_messages c JOIN trip_members m ON m.id = c.member_id JOIN trips t ON t.id = c.trip_id
                WHERE m.user_id = ?
                ORDER BY c.created_at DESC
                """, row -> {
            Map<String, Object> message = new LinkedHashMap<>();
            message.put("trip", row.getString("name"));
            message.put("text", row.getString("body"));
            message.put("sentAt", instant(row.getTimestamp("created_at")));
            messages.add(message);
        }, userId);
        return messages;
    }

    private List<Map<String, Object>> alerts(UUID userId) {
        List<Map<String, Object>> alerts = new ArrayList<>();
        jdbc.query("""
                SELECT kind, trip_name, actor_name, created_at, read_at FROM alerts
                WHERE user_id = ? ORDER BY created_at DESC
                """, row -> {
            Map<String, Object> alert = new LinkedHashMap<>();
            alert.put("kind", row.getString("kind"));
            alert.put("trip", row.getString("trip_name"));
            alert.put("about", row.getString("actor_name"));
            alert.put("createdAt", instant(row.getTimestamp("created_at")));
            alert.put("readAt", instant(row.getTimestamp("read_at")));
            alerts.add(alert);
        }, userId);
        return alerts;
    }

    private static Instant instant(Timestamp value) {
        return value == null ? null : value.toInstant();
    }
}
