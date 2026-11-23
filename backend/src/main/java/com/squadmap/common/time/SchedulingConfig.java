package com.squadmap.common.time;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.SchedulingConfigurer;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.scheduling.config.ScheduledTaskRegistrar;

/**
 * Turns on {@code @Scheduled} jobs. Jobs written so far are safe to run on every instance at once;
 * a job that must run on exactly one instance needs a shared lock first.
 *
 * <p>The jobs get threads of their own. Left alone, Spring would run them on the live connection's broker
 * threads (the only task scheduler it finds), where a job waiting on a slow or missing database would hold
 * up the live connections.
 */
@Configuration
@EnableScheduling
@ConditionalOnProperty(name = "squadmap.scheduling.enabled", havingValue = "true", matchIfMissing = true)
public class SchedulingConfig implements SchedulingConfigurer {

    @Override
    public void configureTasks(ScheduledTaskRegistrar registrar) {
        ThreadPoolTaskScheduler jobs = new ThreadPoolTaskScheduler();
        jobs.setPoolSize(2);
        jobs.setThreadNamePrefix("jobs-");
        jobs.setWaitForTasksToCompleteOnShutdown(true);
        jobs.setAwaitTerminationSeconds(10);
        jobs.initialize();
        registrar.setTaskScheduler(jobs);
    }
}
