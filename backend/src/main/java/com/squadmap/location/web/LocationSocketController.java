package com.squadmap.location.web;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.ratelimit.RateLimitedException;
import com.squadmap.location.dto.LiveError;
import com.squadmap.location.dto.LocationUpdate;
import com.squadmap.location.service.LocationService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageExceptionHandler;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.annotation.SendToUser;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

/** Location updates over the live connection. Refusals go back to the sender alone, on its error queue. */
@Controller
public class LocationSocketController {

    private static final Logger log = LoggerFactory.getLogger(LocationSocketController.class);

    private final LocationService locations;

    public LocationSocketController(LocationService locations) {
        this.locations = locations;
    }

    @MessageMapping("trip.{tripId}.loc")
    public void publish(@DestinationVariable UUID tripId, @Payload LocationUpdate update, Principal principal) {
        locations.publish(tripId, ((LivePrincipal) principal).caller(), update);
    }

    @MessageExceptionHandler(ApiException.class)
    @SendToUser(destinations = "/queue/errors", broadcast = false)
    public LiveError refused(ApiException e) {
        Long retryAfter = e instanceof RateLimitedException limited ? limited.getRetryAfterSeconds() : null;
        return new LiveError(e.getCode(), e.getMessage(), retryAfter);
    }

    /** A message that isn't a location at all (bad JSON, wrong types). Its content is not logged. */
    @MessageExceptionHandler
    @SendToUser(destinations = "/queue/errors", broadcast = false)
    public LiveError unreadable(Exception e) {
        log.debug("Live message refused: {}", e.getClass().getName());
        return new LiveError(ErrorCode.VALIDATION_FAILED, "That location update couldn't be read.", null);
    }
}
