package com.squadmap.common.ratelimit;

import io.github.bucket4j.distributed.proxy.ProxyManager;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class RateLimiterTest {

    @Test
    @SuppressWarnings("unchecked")
    void letsRequestsThroughWhenRedisIsUnavailable() {
        ProxyManager<String> buckets = mock(ProxyManager.class);
        when(buckets.getProxy(anyString(), any())).thenThrow(new IllegalStateException("connection refused"));
        RateLimiter limiter = new RateLimiter(buckets);

        assertThatCode(() -> limiter.check(RateLimit.LOGIN_PER_IP, "203.0.113.1")).doesNotThrowAnyException();
    }
}
