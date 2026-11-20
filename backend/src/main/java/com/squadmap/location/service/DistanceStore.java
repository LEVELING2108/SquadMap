package com.squadmap.location.service;

import com.squadmap.common.geo.GeoMath;
import com.squadmap.location.domain.Position;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * How far each member has moved while sharing, as one running total in Redis. Only the total and the
 * last counted point are held, and only while the trip runs; the total is saved with the member when the
 * trip ends or they leave, and the rest is deleted.
 *
 * <p>Phones wander even when standing still, so a move counts only once it is longer than both readings'
 * accuracy together (and at least {@value #MIN_STEP_M} m). Until then the last counted point stays put, so
 * slow walking still adds up. The total leans towards too short rather than too long.
 */
@Component
public class DistanceStore {

    static final double MIN_STEP_M = 10;
    /** Longer than any trip can last (12 hours), so a running total never disappears mid-trip. */
    static final Duration TTL = Duration.ofHours(13);

    private static final String TOTAL = "m";
    private static final String LAT = "lat";
    private static final String LNG = "lng";
    private static final String ACC = "acc";

    private final StringRedisTemplate redis;

    public DistanceStore(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** Adds the move to this reading, if it is a real move. The first reading only sets the starting point. */
    public void record(UUID tripId, UUID memberId, Position position) {
        String key = key(tripId, memberId);
        Map<Object, Object> stored = redis.opsForHash().entries(key);
        Map<String, String> next = new HashMap<>();
        if (stored.isEmpty()) {
            next.put(TOTAL, "0");
            anchorAt(next, position);
        } else {
            double lat = Double.parseDouble((String) stored.get(LAT));
            double lng = Double.parseDouble((String) stored.get(LNG));
            double acc = Double.parseDouble((String) stored.get(ACC));
            double step = GeoMath.metres(lat, lng, position.lat(), position.lng());
            if (step <= Math.max(MIN_STEP_M, acc + position.acc())) {
                // Too small to tell from wandering readings: keep the starting point.
                if (position.acc() < acc && step < MIN_STEP_M) {
                    // A sharper reading of the same spot is a better point to measure from.
                    anchorAt(next, position);
                    redis.opsForHash().putAll(key, next);
                }
                redis.expire(key, TTL);
                return;
            }
            double total = Double.parseDouble((String) stored.get(TOTAL)) + step;
            next.put(TOTAL, Long.toString(Math.round(total)));
            anchorAt(next, position);
        }
        redis.opsForHash().putAll(key, next);
        redis.expire(key, TTL);
    }

    /** The member's total so far in metres, or null if they haven't shared a location on this trip. */
    public Integer total(UUID tripId, UUID memberId) {
        Object value = redis.opsForHash().get(key(tripId, memberId), TOTAL);
        return value == null ? null : (int) Math.min(Integer.MAX_VALUE, Long.parseLong((String) value));
    }

    /** The totals of these members, by member id; members who never shared are left out. */
    public Map<UUID, Integer> totals(UUID tripId, Collection<UUID> memberIds) {
        Map<UUID, Integer> found = new HashMap<>();
        for (UUID memberId : memberIds) {
            Integer total = total(tripId, memberId);
            if (total != null) {
                found.put(memberId, total);
            }
        }
        return found;
    }

    public void delete(UUID tripId, Collection<UUID> memberIds) {
        if (!memberIds.isEmpty()) {
            redis.delete(List.copyOf(memberIds).stream().map(id -> key(tripId, id)).toList());
        }
    }

    private static void anchorAt(Map<String, String> fields, Position position) {
        fields.put(LAT, Double.toString(position.lat()));
        fields.put(LNG, Double.toString(position.lng()));
        fields.put(ACC, Double.toString(position.acc()));
    }

    static String key(UUID tripId, UUID memberId) {
        return "trip:" + tripId + ":dist:" + memberId;
    }
}
