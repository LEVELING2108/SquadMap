package com.squadmap.common.time;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on {@code @Scheduled} jobs. Jobs written so far are safe to run on every instance at once;
 * a job that must run on exactly one instance needs a shared lock first.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "squadmap.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig {
}
