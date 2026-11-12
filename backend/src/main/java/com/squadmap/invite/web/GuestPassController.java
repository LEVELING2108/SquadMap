package com.squadmap.invite.web;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.security.Caller;
import com.squadmap.invite.dto.JoinResponse;
import com.squadmap.invite.service.JoinService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@Tag(name = "Join")
public class GuestPassController {

    private final JoinService joins;

    public GuestPassController(JoinService joins) {
        this.joins = joins;
    }

    @PostMapping("/api/v1/trips/{tripId}/guest-pass")
    @Operation(summary = "Renew my guest pass",
            description = "For guests, after the host extends the trip: returns a pass valid until the new end time.")
    public JoinResponse renew(@AuthenticationPrincipal Jwt token, @PathVariable UUID tripId) {
        Caller caller = Caller.from(token);
        if (!caller.isGuest() || !caller.mayUseTrip(tripId)) {
            throw new ApiException(HttpStatus.NOT_FOUND, ErrorCode.TRIP_NOT_FOUND, "This trip doesn't exist.");
        }
        return joins.renewGuestPass(tripId, caller.subject());
    }
}
