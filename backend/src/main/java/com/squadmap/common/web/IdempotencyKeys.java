package com.squadmap.common.web;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.security.SecureTokens;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * The {@code Idempotency-Key} header: a client sends the same key when it retries a create, and gets the
 * first result back instead of creating a second thing. Keys are remembered for a day, per account.
 */
@Component
public class IdempotencyKeys {

    public static final String HEADER = "Idempotency-Key";
    private static final Duration REMEMBER = Duration.ofHours(24);
    private static final String PENDING = "pending";

    private final StringRedisTemplate redis;

    public IdempotencyKeys(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /**
     * Runs {@code create} once per key. A repeat returns {@code replay} of the id the first call stored.
     *
     * @param scope   what is being created, for example "trip"
     * @param owner   whose key it is; keys never collide between accounts
     * @param key     the header value, or {@code null} to skip all of this
     * @param create  makes the thing and returns its id
     * @param replay  turns a stored id back into the response
     * @throws ApiException 409 {@code REQUEST_IN_PROGRESS} when the first call with this key is still running
     */
    public <T> Result<T> once(String scope, String owner, String key, Supplier<IdAnd<T>> create,
                              Function<String, T> replay) {
        if (key == null || key.isBlank()) {
            return new Result<>(create.get().value(), false);
        }
        if (key.length() > 100) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.BAD_REQUEST,
                    HEADER + " must be 100 characters or fewer.");
        }
        String redisKey = "idem:" + scope + ":" + owner + ":" + SecureTokens.hash(key);

        Boolean first = redis.opsForValue().setIfAbsent(redisKey, PENDING, REMEMBER);
        if (!Boolean.TRUE.equals(first)) {
            String stored = Optional.ofNullable(redis.opsForValue().get(redisKey)).orElse(PENDING);
            if (PENDING.equals(stored)) {
                throw new ApiException(HttpStatus.CONFLICT, ErrorCode.REQUEST_IN_PROGRESS,
                        "This request is already being handled. Try again in a moment.");
            }
            return new Result<>(replay.apply(stored), true);
        }

        try {
            IdAnd<T> made = create.get();
            redis.opsForValue().set(redisKey, made.id(), REMEMBER);
            return new Result<>(made.value(), false);
        } catch (RuntimeException e) {
            // Nothing was created, so a retry with the same key should try again.
            redis.delete(redisKey);
            throw e;
        }
    }

    /** What a create returns: the new thing's id (to remember) and the response. */
    public record IdAnd<T>(String id, T value) {
    }

    /** @param replayed true when this is the stored result of an earlier call with the same key */
    public record Result<T>(T value, boolean replayed) {
    }
}
