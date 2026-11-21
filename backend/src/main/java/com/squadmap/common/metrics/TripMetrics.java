package com.squadmap.common.metrics;

import com.squadmap.trip.repo.TripRepository;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.time.Clock;

/** How many trips are running and how many phones are connected live, read when Prometheus asks. */
@Component
public class TripMetrics {

    private final AppMetrics metrics;

    public TripMetrics(MeterRegistry registry, TripRepository trips, Clock clock, AppMetrics metrics) {
        this.metrics = metrics;
        Gauge.builder("squadmap.trips.active", () -> trips.countLive(clock.instant()))
                .description("Trips running now")
                .register(registry);
    }

    @EventListener
    public void connected(SessionConnectedEvent event) {
        metrics.connectionOpened();
    }

    @EventListener
    public void disconnected(SessionDisconnectEvent event) {
        metrics.connectionClosed();
    }
}
