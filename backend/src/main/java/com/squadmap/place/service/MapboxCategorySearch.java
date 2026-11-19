package com.squadmap.place.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.place.config.MapboxProperties;
import com.squadmap.place.domain.GeoPoint;
import com.squadmap.place.domain.NearbyCategory;
import com.squadmap.place.domain.Place;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.List;

/**
 * Mapbox Search Box category search: businesses and sights of one kind near a point. Results may be shown
 * but not stored, so nothing here keeps them. Like place search, it never logs the point or the token.
 */
@Component
public class MapboxCategorySearch {

    private static final Logger log = LoggerFactory.getLogger(MapboxCategorySearch.class);

    private final MapboxProperties properties;
    private final RestClient client;

    public MapboxCategorySearch(MapboxProperties properties, RestClient.Builder builder) {
        this.properties = properties;
        HttpClient http = HttpClient.newBuilder().connectTimeout(properties.timeout()).build();
        JdkClientHttpRequestFactory requests = new JdkClientHttpRequestFactory(http);
        requests.setReadTimeout(properties.timeout());
        this.client = builder.baseUrl(properties.baseUrl()).requestFactory(requests).build();
    }

    /** @throws com.squadmap.common.error.ApiException 503 {@code PLACES_UNAVAILABLE} when Mapbox can't be used */
    public List<Place> near(NearbyCategory category, GeoPoint point, int limit) {
        if (!properties.hasToken()) {
            log.warn("Nearby search is off: no Mapbox server token is configured (MAPBOX_SERVER_TOKEN)");
            throw MapboxGeocoder.unavailable();
        }
        JsonNode body;
        try {
            body = client.get()
                    .uri(builder -> builder.path("/search/searchbox/v1/category/{category}")
                            .queryParam("proximity", point.lng() + "," + point.lat())
                            .queryParam("limit", limit)
                            .queryParam("language", "en")
                            .queryParam("access_token", "{token}")
                            .build(category.mapboxId(), properties.token()))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            log.warn("Mapbox category search answered {}", e.getStatusCode().value());
            throw MapboxGeocoder.unavailable();
        } catch (RuntimeException e) {
            log.warn("Mapbox category search failed: {}", e.getClass().getSimpleName());
            throw MapboxGeocoder.unavailable();
        }
        return parse(body, category);
    }

    private static List<Place> parse(JsonNode body, NearbyCategory category) {
        List<Place> places = new ArrayList<>();
        if (body == null) {
            return places;
        }
        for (JsonNode feature : body.path("features")) {
            JsonNode p = feature.path("properties");
            JsonNode coordinates = p.path("coordinates");
            String name = p.path("name").asText("");
            if (name.isBlank() || !coordinates.has("latitude") || !coordinates.has("longitude")) {
                continue;
            }
            String address = p.path("full_address").asText(p.path("place_formatted").asText(""));
            places.add(new Place(p.path("mapbox_id").asText(""), name, address.isBlank() ? null : address,
                    new GeoPoint(coordinates.get("latitude").asDouble(), coordinates.get("longitude").asDouble()),
                    category.name()));
        }
        return places;
    }
}
