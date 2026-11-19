package com.squadmap.eta.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.squadmap.eta.domain.Eta;
import com.squadmap.eta.domain.Route;
import com.squadmap.eta.domain.TravelMode;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * ETAs, shared routes and arrival timers, in Redis only. Everything here expires by itself and is deleted
 * with the member's spot when they leave or the trip ends.
 */
@Component
public class EtaStore {

    /** Like a spot: an ETA nobody has refreshed for this long is gone. */
    static final Duration ETA_TTL = Duration.ofMinutes(10);
    /** A route is shared by everyone starting from the same ~50 m square for this long. */
    static final Duration ROUTE_TTL = Duration.ofSeconds(20);
    /** Only one ETA is worked out per member at a time; this frees the turn if a run dies. */
    static final Duration TURN_TTL = Duration.ofSeconds(15);

    private final StringRedisTemplate redis;
    private final ObjectMapper json;

    public EtaStore(StringRedisTemplate redis, ObjectMapper json) {
        this.redis = redis;
        this.json = json;
    }

    public Eta get(UUID tripId, UUID memberId) {
        return read(redis.opsForValue().get(etaKey(tripId, memberId)), Eta.class);
    }

    public Map<UUID, Eta> getAll(UUID tripId, Collection<UUID> memberIds) {
        List<UUID> ids = new ArrayList<>(memberIds);
        Map<UUID, Eta> found = new HashMap<>();
        if (ids.isEmpty()) {
            return found;
        }
        List<String> values = redis.opsForValue().multiGet(ids.stream().map(id -> etaKey(tripId, id)).toList());
        for (int i = 0; i < ids.size() && values != null; i++) {
            Eta eta = read(values.get(i), Eta.class);
            if (eta != null) {
                found.put(ids.get(i), eta);
            }
        }
        return found;
    }

    public void put(UUID tripId, Eta eta) {
        redis.opsForValue().set(etaKey(tripId, eta.memberId()), write(eta), ETA_TTL);
    }

    public Route cachedRoute(String key) {
        return read(redis.opsForValue().get(key), Route.class);
    }

    public void cacheRoute(String key, Route route) {
        redis.opsForValue().set(key, write(route), ROUTE_TTL);
    }

    /**
     * The key for a route from a ~50 m square to the destination, so friends travelling together, or a
     * person barely moving, share one Mapbox call.
     */
    public static String routeKey(TravelMode mode, double fromLat, double fromLng, double toLat, double toLng) {
        return "route:" + mode.profile() + ":" + Math.round(fromLat * 2000) + ":" + Math.round(fromLng * 2000) + ":"
                + Math.round(toLat * 100_000) + ":" + Math.round(toLng * 100_000);
    }

    /** Claims the member's turn to have an ETA worked out; false while another run has it. */
    public boolean takeTurn(UUID tripId, UUID memberId) {
        return Boolean.TRUE.equals(redis.opsForValue().setIfAbsent(turnKey(tripId, memberId), "1", TURN_TTL));
    }

    public void endTurn(UUID tripId, UUID memberId) {
        redis.delete(turnKey(tripId, memberId));
    }

    /**
     * When the member was first seen within the arrival radius in this visit, recording now if this is the
     * first time. Expires with the spot, so a visit long ago doesn't count.
     */
    public Instant insideSince(UUID tripId, UUID memberId, Instant now) {
        String key = arriveKey(tripId, memberId);
        redis.opsForValue().setIfAbsent(key, now.toString(), ETA_TTL);
        String value = redis.opsForValue().get(key);
        return value == null ? now : Instant.parse(value);
    }

    /** They left the arrival radius: the 20 seconds start again next time. */
    public void wentOutside(UUID tripId, UUID memberId) {
        redis.delete(arriveKey(tripId, memberId));
    }

    /** Everything about these members on this trip. */
    public void delete(UUID tripId, Collection<UUID> memberIds) {
        List<String> keys = new ArrayList<>();
        for (UUID id : memberIds) {
            keys.add(etaKey(tripId, id));
            keys.add(arriveKey(tripId, id));
            keys.add(turnKey(tripId, id));
        }
        if (!keys.isEmpty()) {
            redis.delete(keys);
        }
    }

    private String write(Object value) {
        try {
            return json.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("ETA could not be written", e);
        }
    }

    private <T> T read(String value, Class<T> type) {
        if (value == null) {
            return null;
        }
        try {
            return json.readValue(value, type);
        } catch (JsonProcessingException e) {
            return null;
        }
    }

    static String etaKey(UUID tripId, UUID memberId) {
        return "eta:" + tripId + ":" + memberId;
    }

    static String arriveKey(UUID tripId, UUID memberId) {
        return "arrive:" + tripId + ":" + memberId;
    }

    static String turnKey(UUID tripId, UUID memberId) {
        return "eta-turn:" + tripId + ":" + memberId;
    }
}
