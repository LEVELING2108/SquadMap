package com.squadmap.place.web;

import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.common.security.CurrentUser;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.place.domain.GeoPoint;
import com.squadmap.place.domain.NearbyCategory;
import com.squadmap.place.dto.PlaceResponse;
import com.squadmap.place.service.PlaceService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/places")
@Tag(name = "Places")
public class PlaceController {

    /** "lat,lng" in degrees, for example 18.5622,73.9167. Range is checked after parsing. */
    private static final String NEAR = "^-?\\d{1,2}(\\.\\d+)?,-?\\d{1,3}(\\.\\d+)?$";

    private final PlaceService places;
    private final RateLimiter rateLimiter;

    public PlaceController(PlaceService places, RateLimiter rateLimiter) {
        this.places = places;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/search")
    @Operation(summary = "Search for a place",
            description = "Up to 6 places matching the text, nearest first when `near` is given. Results are for "
                    + "display only: to save one as a trip's destination, send it back with `fromSearch: true` when "
                    + "creating the trip. 503 PLACES_UNAVAILABLE when search can't be used right now.")
    public List<PlaceResponse> search(
            @AuthenticationPrincipal Jwt token,
            @RequestParam @NotBlank(message = "Type at least 2 characters.")
            @Size(min = 2, max = 100, message = "Use between 2 and 100 characters.") String q,
            @Parameter(description = "Where you are, as lat,lng; rounded to about 1 km before it leaves the server")
            @RequestParam(required = false) @Pattern(regexp = NEAR, message = "Use lat,lng in degrees.") String near) {
        rateLimiter.check(RateLimit.PLACE_SEARCH_PER_USER, CurrentUser.id(token).toString());
        return places.search(q, parseNear(near));
    }

    @GetMapping("/nearby")
    @Operation(summary = "Places of one kind nearby",
            description = "Up to 10 cafes, stays or sights near a point, nearest first, for the Home chips. For "
                    + "display only. 503 PLACES_UNAVAILABLE when search can't be used right now.")
    public List<PlaceResponse> nearby(
            @AuthenticationPrincipal Jwt token,
            @RequestParam NearbyCategory category,
            @Parameter(description = "The point to search around, as lat,lng; rounded to about 100 m before it "
                    + "leaves the server")
            @RequestParam @Pattern(regexp = NEAR, message = "Use lat,lng in degrees.") String near) {
        rateLimiter.check(RateLimit.NEARBY_PER_USER, CurrentUser.id(token).toString());
        GeoPoint point = parseNear(near);
        if (point == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "One or more fields are invalid.")
                    .with("errors", List.of(Map.of("field", "near", "message", "Use lat,lng in degrees.")));
        }
        return places.nearby(category, point);
    }

    private static GeoPoint parseNear(String near) {
        if (near == null) {
            return null;
        }
        String[] parts = near.split(",");
        double lat = Double.parseDouble(parts[0]);
        double lng = Double.parseDouble(parts[1]);
        // Out of range is treated as "no location" rather than an error: it only orders the results.
        if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
            return null;
        }
        return new GeoPoint(lat, lng);
    }
}
