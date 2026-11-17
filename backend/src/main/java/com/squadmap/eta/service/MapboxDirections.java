package com.squadmap.eta.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.eta.domain.Route;
import com.squadmap.eta.domain.TravelMode;
import com.squadmap.place.config.MapboxProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.http.HttpClient;
import java.util.Locale;
import java.util.Optional;

/**
 * Mapbox Directions: a route and travel time between two points. Never logs the points or the token.
 * Any failure is an empty answer; the caller then estimates instead.
 */
@Component
public class MapboxDirections {

    private static final Logger log = LoggerFactory.getLogger(MapboxDirections.class);

    private final MapboxProperties properties;
    private final RestClient client;

    public MapboxDirections(MapboxProperties properties, RestClient.Builder builder) {
        this.properties = properties;
        HttpClient http = HttpClient.newBuilder().connectTimeout(properties.timeout()).build();
        JdkClientHttpRequestFactory requests = new JdkClientHttpRequestFactory(http);
        requests.setReadTimeout(properties.timeout());
        this.client = builder.baseUrl(properties.baseUrl()).requestFactory(requests).build();
    }

    public boolean available() {
        return properties.hasToken();
    }

    public Optional<Route> route(double fromLat, double fromLng, double toLat, double toLng, TravelMode mode) {
        if (!properties.hasToken()) {
            return Optional.empty();
        }
        String coordinates = String.format(Locale.ROOT, "%.6f,%.6f;%.6f,%.6f", fromLng, fromLat, toLng, toLat);
        JsonNode body;
        try {
            body = client.get()
                    // The coordinates are formatted numbers, so they go in the path as they are: as a URI
                    // variable the ';' between them would be encoded, which Mapbox doesn't read as a separator.
                    .uri(builder -> builder.path("/directions/v5/mapbox/" + mode.profile() + "/" + coordinates)
                            .queryParam("geometries", "polyline6")
                            // The whole line: a simplified one cuts across blocks on longer trips.
                            .queryParam("overview", "full")
                            .queryParam("access_token", "{token}")
                            .build(properties.token()))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            log.warn("Mapbox Directions answered {}", e.getStatusCode().value());
            return Optional.empty();
        } catch (RuntimeException e) {
            log.warn("Mapbox Directions failed: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
        JsonNode first = body == null ? null : body.path("routes").path(0);
        if (first == null || first.isMissingNode() || !first.has("distance") || !first.has("duration")) {
            return Optional.empty();
        }
        return Optional.of(new Route(first.get("distance").asDouble(), first.get("duration").asDouble(),
                first.path("geometry").asText(null)));
    }
}
