package com.squadmap.location.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
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
 * Last known spots, in Redis only. Each one disappears {@link #TTL} after the member's last update, except
 * while the member has paused, and all of a trip's spots are deleted when it ends or they leave, so no
 * location history is ever kept.
 */
@Component
public class PositionStore {

    /** A spot older than this is gone: the member stopped sending, closed the app or lost signal. */
    public static final Duration TTL = Duration.ofMinutes(10);

    private final StringRedisTemplate redis;
    private final ObjectMapper json;

    public PositionStore(StringRedisTemplate redis, ObjectMapper json) {
        this.redis = redis;
        this.json = json;
    }

    public void put(UUID tripId, UUID memberId, Position position) {
        try {
            redis.opsForValue().set(key(tripId, memberId), json.writeValueAsString(position), TTL);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Position could not be written", e);
        }
    }

    public Position get(UUID tripId, UUID memberId) {
        return read(redis.opsForValue().get(key(tripId, memberId)));
    }

    /** The spots of these members that are still fresh, by member id. Members with none are left out. */
    public Map<UUID, Position> getAll(UUID tripId, Collection<UUID> memberIds) {
        List<UUID> ids = List.copyOf(memberIds);
        if (ids.isEmpty()) {
            return Map.of();
        }
        List<String> values = redis.opsForValue().multiGet(ids.stream().map(id -> key(tripId, id)).toList());
        Map<UUID, Position> found = new HashMap<>();
        for (int i = 0; i < ids.size() && values != null; i++) {
            Position position = read(values.get(i));
            if (position != null) {
                found.put(ids.get(i), position);
            }
        }
        return found;
    }

    /** Keeps the member's spot until it is deleted: they paused, and friends see where they were. */
    public void keep(UUID tripId, UUID memberId) {
        redis.persist(key(tripId, memberId));
    }

    /** Lets the member's spot run out {@link #TTL} from now again, as for anyone sharing: they resumed. */
    public void expireAgain(UUID tripId, UUID memberId) {
        redis.expire(key(tripId, memberId), TTL);
    }

    public void delete(UUID tripId, Collection<UUID> memberIds) {
        if (!memberIds.isEmpty()) {
            redis.delete(memberIds.stream().map(id -> key(tripId, id)).toList());
        }
    }

    private Position read(String value) {
        if (value == null) {
            return null;
        }
        try {
            return json.readValue(value, Position.class);
        } catch (JsonProcessingException e) {
            // A value this code didn't write (say, from an older version): treat it as no spot.
            return null;
        }
    }

    static String key(UUID tripId, UUID memberId) {
        return "trip:" + tripId + ":loc:" + memberId;
    }
}
