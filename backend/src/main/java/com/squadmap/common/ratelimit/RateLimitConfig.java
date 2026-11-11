package com.squadmap.common.ratelimit;

import io.github.bucket4j.distributed.ExpirationAfterWriteStrategy;
import io.github.bucket4j.distributed.proxy.ProxyManager;
import io.github.bucket4j.redis.lettuce.Bucket4jLettuce;
import io.lettuce.core.RedisClient;
import io.lettuce.core.RedisURI;
import io.lettuce.core.api.StatefulRedisConnection;
import io.lettuce.core.codec.ByteArrayCodec;
import io.lettuce.core.codec.RedisCodec;
import io.lettuce.core.codec.StringCodec;
import org.springframework.boot.autoconfigure.data.redis.RedisConnectionDetails;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * Rate-limit buckets live in the same Redis as the rest of the app. The connection settings come
 * from Spring's Redis configuration, so local, test and production setups need nothing extra.
 */
@Configuration
public class RateLimitConfig {

    @Bean(destroyMethod = "shutdown")
    RedisClient rateLimitRedisClient(RedisConnectionDetails details) {
        RedisConnectionDetails.Standalone standalone = details.getStandalone();
        RedisURI.Builder uri = RedisURI.builder()
                .withHost(standalone.getHost())
                .withPort(standalone.getPort())
                .withDatabase(standalone.getDatabase())
                .withTimeout(Duration.ofSeconds(2));
        if (details.getPassword() != null) {
            if (details.getUsername() != null) {
                uri.withAuthentication(details.getUsername(), details.getPassword());
            } else {
                uri.withPassword(details.getPassword().toCharArray());
            }
        }
        return RedisClient.create(uri.build());
    }

    @Bean(destroyMethod = "close")
    StatefulRedisConnection<String, byte[]> rateLimitRedisConnection(RedisClient rateLimitRedisClient) {
        return rateLimitRedisClient.connect(RedisCodec.of(StringCodec.UTF8, ByteArrayCodec.INSTANCE));
    }

    @Bean
    ProxyManager<String> rateLimitBuckets(StatefulRedisConnection<String, byte[]> rateLimitRedisConnection) {
        return Bucket4jLettuce.casBasedBuilder(rateLimitRedisConnection)
                // A bucket is deleted shortly after it has refilled completely, so idle keys do not pile up.
                .expirationAfterWrite(ExpirationAfterWriteStrategy.basedOnTimeForRefillingBucketUpToMax(
                        Duration.ofSeconds(10)))
                .requestTimeout(Duration.ofSeconds(2))
                .build();
    }
}
