package com.squadmap.common.metrics;

import io.micrometer.core.instrument.Meter;
import io.micrometer.core.instrument.Tag;
import io.micrometer.core.instrument.config.MeterFilter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class MetricsConfig {

    /**
     * Outgoing calls (Mapbox routes and places) are never recorded with their address: it can hold
     * coordinates or search words. Incoming requests are fine as they are: they're recorded by route
     * template, such as /api/v1/trips/{tripId}, never by the actual id.
     */
    @Bean
    MeterFilter noAddressesOnOutgoingCalls() {
        return new MeterFilter() {
            @Override
            public Meter.Id map(Meter.Id id) {
                if (!id.getName().startsWith("http.client.requests") || id.getTag("uri") == null) {
                    return id;
                }
                List<Tag> tags = id.getTags().stream()
                        .map(tag -> "uri".equals(tag.getKey()) ? Tag.of("uri", "none") : tag)
                        .toList();
                return id.replaceTags(tags);
            }
        };
    }
}
