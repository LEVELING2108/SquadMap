package com.squadmap.common.ratelimit;

import com.squadmap.common.security.SecureTokens;
import io.github.bucket4j.BucketConfiguration;
import io.github.bucket4j.ConsumptionProbe;
import io.github.bucket4j.EstimationProbe;
import io.github.bucket4j.distributed.BucketProxy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * Counts requests per limit and key in Redis, so every app instance shares the same counts.
 * Keys are hashed before they reach Redis: no email address or IP address is stored there.
 */
@Component
public class RateLimiter {

    private static final Logger log = LoggerFactory.getLogger(RateLimiter.class);
    private static final String PREFIX = "rl:";

    private final ProxyManager<String> buckets;
    private final Map<RateLimit, BucketConfiguration> configurations = new EnumMap<>(RateLimit.class);

    public RateLimiter(ProxyManager<String> buckets) {
        this.buckets = buckets;
        for (RateLimit limit : RateLimit.values()) {
            configurations.put(limit, BucketConfiguration.builder()
                    .addLimit(bandwidth -> bandwidth.capacity(limit.capacity())
                            .refillGreedy(limit.capacity(), limit.period()))
                    .build());
        }
    }

    /**
     * Uses up one request from the limit for this key.
     *
     * @throws RateLimitedException when the limit is used up
     */
    public void check(RateLimit limit, String key) {
        ConsumptionProbe probe;
        try {
            probe = bucket(limit, key).tryConsumeAndReturnRemaining(1);
        } catch (RuntimeException e) {
            // If Redis is unreachable, let the request through rather than lock everyone out.
            // An outage is visible in health checks and alerts; a silent lockout would not be.
            log.error("Rate limit check skipped, Redis unavailable: {}", e.getClass().getName());
            return;
        }
        if (!probe.isConsumed()) {
            throw new RateLimitedException(seconds(probe.getNanosToWaitForRefill()));
        }
    }

    /**
     * Refuses the request if the limit is already used up, without using any of it.
     * Paired with {@link #record} for limits that count failures, such as wrong trip codes.
     *
     * @throws RateLimitedException when the limit is used up
     */
    public void checkNotLockedOut(RateLimit limit, String key) {
        EstimationProbe probe;
        try {
            probe = bucket(limit, key).estimateAbilityToConsume(1);
        } catch (RuntimeException e) {
            log.error("Rate limit check skipped, Redis unavailable: {}", e.getClass().getName());
            return;
        }
        if (!probe.canBeConsumed()) {
            throw new RateLimitedException(seconds(probe.getNanosToWaitForRefill()));
        }
    }

    /** Counts one occurrence (for example a wrong code) against the limit, without refusing anything now. */
    public void record(RateLimit limit, String key) {
        try {
            bucket(limit, key).tryConsume(1);
        } catch (RuntimeException e) {
            log.error("Rate limit not recorded, Redis unavailable: {}", e.getClass().getName());
        }
    }

    private BucketProxy bucket(RateLimit limit, String key) {
        return buckets.getProxy(PREFIX + limit.id() + ":" + SecureTokens.hash(key), () -> configurations.get(limit));
    }

    private static long seconds(long nanos) {
        return Math.max(1, TimeUnit.NANOSECONDS.toSeconds(nanos) + 1);
    }
}
