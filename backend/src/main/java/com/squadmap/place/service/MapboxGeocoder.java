package com.squadmap.place.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.place.config.MapboxProperties;
import com.squadmap.place.domain.GeoPoint;
import com.squadmap.place.domain.Place;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriBuilder;

import java.net.URI;
import java.net.http.HttpClient;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Mapbox Geocoding v6, forward search.
 *
 * <p>Temporary results (the default) may be shown but never stored, so nothing here caches them.
 * A place that is going to be saved is looked up again with {@code permanent=true}, which Mapbox
 * allows to be stored.
 *
 * <p>Neither the search text, the coordinates nor the token are ever logged: Mapbox errors are logged
 * by status only, because their messages can include the request address with the token in it.
 */
@Component
public class MapboxGeocoder {

    private static final Logger log = LoggerFactory.getLogger(MapboxGeocoder.class);

    private final MapboxProperties properties;
    private final RestClient client;

    public MapboxGeocoder(MapboxProperties properties, RestClient.Builder builder) {
        this.properties = properties;
        HttpClient http = HttpClient.newBuilder().connectTimeout(properties.timeout()).build();
        JdkClientHttpRequestFactory requests = new JdkClientHttpRequestFactory(http);
        requests.setReadTimeout(properties.timeout());
        this.client = builder.baseUrl(properties.baseUrl()).requestFactory(requests).build();
    }

    /**
     * @param near      results close to here come first; send it already {@link GeoPoint#coarse() coarse}
     *                  unless it is a place, not a person
     * @param permanent true only for a result that will be stored
     * @throws ApiException 503 {@code PLACES_UNAVAILABLE} when Mapbox can't be used or reached
     */
    public List<Place> search(String query, GeoPoint near, int limit, boolean permanent) {
        if (!properties.hasToken()) {
            log.warn("Place search is off: no Mapbox server token is configured (MAPBOX_SERVER_TOKEN)");
            throw unavailable();
        }
        JsonNode body;
        try {
            body = client.get()
                    .uri(builder -> uri(builder, query, near, limit, permanent))
                    .retrieve()
                    .body(JsonNode.class);
        } catch (RestClientResponseException e) {
            log.warn("Mapbox geocoding answered {}", e.getStatusCode().value());
            throw unavailable();
        } catch (RuntimeException e) {
            log.warn("Mapbox geocoding failed: {}", e.getClass().getSimpleName());
            throw unavailable();
        }
        return parse(body);
    }

    private URI uri(UriBuilder builder, String query, GeoPoint near, int limit, boolean permanent) {
        builder.path("/search/geocode/v6/forward")
                .queryParam("q", "{q}")
                .queryParam("limit", limit)
                .queryParam("language", "en")
                .queryParam("autocomplete", !permanent)
                .queryParam("permanent", permanent)
                .queryParam("access_token", "{token}");
        if (properties.country() != null && !properties.country().isBlank()) {
            builder.queryParam("country", properties.country().toLowerCase(Locale.ROOT));
        }
        if (near != null) {
            // Mapbox takes longitude first.
            builder.queryParam("proximity", near.lng() + "," + near.lat());
        }
        // The search text and token go in as encoded variables, so no character in them can change the address.
        return builder.build(query, properties.token());
    }

    private static List<Place> parse(JsonNode body) {
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
            String address = p.path("place_formatted").asText(p.path("full_address").asText(""));
            places.add(new Place(
                    p.path("mapbox_id").asText(feature.path("id").asText("")),
                    name,
                    address.isBlank() ? null : address,
                    new GeoPoint(coordinates.get("latitude").asDouble(), coordinates.get("longitude").asDouble()),
                    p.path("feature_type").asText("place")));
        }
        return places;
    }

    static ApiException unavailable() {
        return new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.PLACES_UNAVAILABLE,
                "Place search isn't available right now. Try again in a moment, or drop a pin on the map.");
    }
}
