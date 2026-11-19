package com.squadmap.trip.service;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.text.Text;
import com.squadmap.place.domain.GeoPoint;
import com.squadmap.place.domain.Place;
import com.squadmap.place.service.PlaceService;
import com.squadmap.trip.domain.Destination;
import com.squadmap.trip.dto.CreateTripRequest.DestinationInput;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Turns what the host chose into the destination that is saved with the trip. */
@Component
public class DestinationResolver {

    private final PlaceService places;

    public DestinationResolver(PlaceService places) {
        this.places = places;
    }

    /**
     * A pin the host dropped is saved as given. A place search result may not be stored as it was shown,
     * so it is looked up again in Mapbox's permanent mode and that version is saved instead.
     *
     * @return null when the trip has no destination
     */
    public Destination resolve(DestinationInput input) {
        if (input == null) {
            return null;
        }
        String name = Text.clean(input.name());
        if (name == null || name.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, "Destination needs a name.")
                    .with("errors", List.of(Map.of("field", "destination.name", "message", "Destination needs a name.")));
        }
        GeoPoint picked = new GeoPoint(input.lat(), input.lng());
        if (!input.fromSearch()) {
            return new Destination(name, picked.lat(), picked.lng());
        }
        Place confirmed = places.confirm(name, picked);
        return new Destination(confirmed.name(), confirmed.point().lat(), confirmed.point().lng());
    }
}
