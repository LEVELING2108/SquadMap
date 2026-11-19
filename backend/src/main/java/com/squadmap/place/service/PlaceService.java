package com.squadmap.place.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.text.Text;
import com.squadmap.place.domain.GeoPoint;
import com.squadmap.place.domain.NearbyCategory;
import com.squadmap.place.domain.Place;
import com.squadmap.place.dto.PlaceResponse;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class PlaceService {

    static final int SEARCH_RESULTS = 6;
    /** How far a re-checked place may be from the one picked and still count as the same place. */
    static final double SAME_PLACE_METERS = 300;
    /** Close enough to be the same spot whatever its name, as when Mapbox adds a house number. */
    static final double SAME_SPOT_METERS = 50;
    private static final int CONFIRM_CANDIDATES = 5;

    static final int NEARBY_RESULTS = 10;

    private final MapboxGeocoder geocoder;
    private final MapboxCategorySearch categories;

    public PlaceService(MapboxGeocoder geocoder, MapboxCategorySearch categories) {
        this.geocoder = geocoder;
        this.categories = categories;
    }

    /**
     * Up to {@value #NEARBY_RESULTS} places of one kind near a point, nearest first. The point goes to Mapbox
     * rounded to about 100 m; the exact one only works out distances here.
     */
    public List<PlaceResponse> nearby(NearbyCategory category, GeoPoint near) {
        return categories.near(category, near.nearby(), NEARBY_RESULTS).stream()
                .map(place -> PlaceResponse.of(place, near))
                .sorted(Comparator.comparing(PlaceResponse::distanceMeters))
                .toList();
    }

    /**
     * @param near where the person is, if they shared it: results nearby come first. Only a rounded
     *             version (about 1 km) is sent to Mapbox; the exact one only works out distances here.
     */
    public List<PlaceResponse> search(String query, GeoPoint near) {
        String cleaned = Text.clean(query);
        if (cleaned == null || cleaned.length() < 2) {
            return List.of();
        }
        return geocoder.search(cleaned, near == null ? null : near.coarse(), SEARCH_RESULTS, false).stream()
                .map(place -> PlaceResponse.of(place, near))
                .toList();
    }

    /**
     * Looks a picked search result up again in Mapbox's permanent mode, which may be stored, and returns
     * that version. It is searched for by name, near where it was picked, and counts as found when a
     * result has the same name within {@value #SAME_PLACE_METERS} m, or is practically on the same spot
     * (within {@value #SAME_SPOT_METERS} m). Anything else is refused rather than saved under another name.
     *
     * @throws ApiException 422 {@code PLACE_NOT_CONFIRMED} when no such place comes back;
     *                      503 {@code PLACES_UNAVAILABLE} when Mapbox can't be reached
     */
    public Place confirm(String name, GeoPoint picked) {
        // The picked point is a place, not where someone is, so it is sent as it is.
        List<Place> candidates = geocoder.search(name, picked, CONFIRM_CANDIDATES, true);
        Comparator<Place> closest = Comparator.comparingDouble(place -> picked.metersTo(place.point()));
        Optional<Place> sameName = candidates.stream()
                .filter(place -> sameName(place.name(), name))
                .filter(place -> picked.metersTo(place.point()) <= SAME_PLACE_METERS)
                .min(closest);
        return sameName
                .or(() -> candidates.stream()
                        .filter(place -> picked.metersTo(place.point()) <= SAME_SPOT_METERS)
                        .min(closest))
                .orElseThrow(() -> new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.PLACE_NOT_CONFIRMED,
                        "We couldn't confirm that place. Search for it again, or drop a pin on the map."));
    }

    private static boolean sameName(String a, String b) {
        return a.strip().replaceAll("\\s+", " ").equalsIgnoreCase(b.strip().replaceAll("\\s+", " "));
    }
}
