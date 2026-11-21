package com.squadmap.common.security;

import org.springframework.boot.web.context.WebServerInitializedEvent;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * The port health and metrics are served on when they have their own (management.server.port in
 * production), as actually opened, so a random test port works too. Zero while there is none.
 */
@Component
public class ManagementPort {

    private final AtomicInteger port = new AtomicInteger();

    @EventListener
    public void opened(WebServerInitializedEvent event) {
        if ("management".equals(event.getApplicationContext().getServerNamespace())) {
            port.set(event.getWebServer().getPort());
        }
    }

    /** Whether a request came in on the management port (never true when there is no separate one). */
    public boolean isOn(int localPort) {
        int management = port.get();
        return management > 0 && management == localPort;
    }
}
