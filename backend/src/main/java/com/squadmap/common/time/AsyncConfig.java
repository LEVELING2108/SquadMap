package com.squadmap.common.time;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/** Turns on {@code @Async}: the work runs on a virtual thread after the request has been answered. */
@Configuration
@EnableAsync
public class AsyncConfig {
}
