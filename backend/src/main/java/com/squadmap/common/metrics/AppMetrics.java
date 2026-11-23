package com.squadmap.common.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * The app's own numbers, on /actuator/prometheus next to the JVM and HTTP ones. Tags are a handful of fixed
 * words: never a trip, a person or a place, so nothing here can tell who is where.
 */
@Component
public class AppMetrics {

    /** Where an ETA's route came from. */
    public enum RouteSource { CACHE, MAPBOX, ESTIMATE }

    private final MeterRegistry registry;
    private final Counter locations;
    private final AtomicInteger liveConnections = new AtomicInteger();

    public AppMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.locations = Counter.builder("squadmap.location.updates")
                .description("Location updates accepted from phones")
                .register(registry);
        registry.gauge("squadmap.live.connections", liveConnections);
    }

    public void locationAccepted() {
        locations.increment();
    }

    public void route(RouteSource source) {
        Counter.builder("squadmap.eta.routes")
                .description("ETA routes, by where they came from (a Mapbox call costs money)")
                .tag("source", source.name().toLowerCase(Locale.ROOT))
                .register(registry)
                .increment();
    }

    /** @param outcome sent, gone or failed */
    public void push(String outcome) {
        Counter.builder("squadmap.push.sends")
                .description("Push notifications handed to push services, by outcome")
                .tag("outcome", outcome.toLowerCase(Locale.ROOT))
                .register(registry)
                .increment();
    }

    public void connectionOpened() {
        liveConnections.incrementAndGet();
    }

    public void connectionClosed() {
        liveConnections.updateAndGet(count -> Math.max(0, count - 1));
    }
}
