package com.squadmap.place.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

/**
 * @param baseUrl Mapbox's API address; tests point it at a stand-in server
 * @param token   the server's own Mapbox token. Without one, place search answers "unavailable"
 * @param timeout how long to wait for Mapbox before giving up
 * @param country ISO country codes results are limited to, comma separated; empty for anywhere
 */
@ConfigurationProperties("squadmap.mapbox")
public record MapboxProperties(
        @DefaultValue("https://api.mapbox.com") String baseUrl,
        String token,
        @DefaultValue("3s") Duration timeout,
        @DefaultValue("in") String country) {

    public boolean hasToken() {
        return token != null && !token.isBlank();
    }

    @Configuration
    @EnableConfigurationProperties(MapboxProperties.class)
    static class Config {
    }
}
