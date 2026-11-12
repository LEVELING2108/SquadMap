package com.squadmap.invite.web;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.common.security.Caller;
import com.squadmap.invite.dto.JoinPreviewResponse;
import com.squadmap.invite.dto.JoinRequest;
import com.squadmap.invite.dto.JoinResponse;
import com.squadmap.invite.service.JoinService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Public join routes, reachable from an invite link without an account. Every call counts towards a
 * per-address limit, and wrong codes count towards a lock-out, so codes can't be guessed.
 */
@RestController
@RequestMapping("/api/v1/join/{code}")
@Tag(name = "Join")
@SecurityRequirements
public class JoinController {

    private final JoinService joins;
    private final RateLimiter rateLimiter;
    private final GuestCookie guestCookie;

    public JoinController(JoinService joins, RateLimiter rateLimiter, GuestCookie guestCookie) {
        this.joins = joins;
        this.rateLimiter = rateLimiter;
        this.guestCookie = guestCookie;
    }

    @GetMapping("/preview")
    @Operation(summary = "What an invite link leads to",
            description = "404 INVALID_CODE for an unknown code, 410 TRIP_EXPIRED once the trip is over.")
    public JoinPreviewResponse preview(@PathVariable String code, HttpServletRequest http) {
        return guarded(http, () -> joins.preview(code));
    }

    @PostMapping
    @Operation(summary = "Join a trip",
            description = "Without a token, joins as a guest, returns a pass for this trip only and keeps it in "
                    + "the guest cookie so a reload doesn't drop them. "
                    + "With an account token, joins as that account.")
    public ResponseEntity<JoinResponse> join(@PathVariable String code, @Valid @RequestBody JoinRequest request,
                             @AuthenticationPrincipal Jwt token, HttpServletRequest http) {
        Optional<UUID> userId = Optional.ofNullable(token).map(Caller::from).map(caller -> {
            if (caller.isGuest()) {
                // A guest pass belongs to one trip; joining another one starts over as a new guest.
                throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN,
                        "Open the link without your current trip pass to join another trip.");
            }
            return caller.subject();
        });
        JoinResponse joined = guarded(http, () -> joins.join(code, request, userId));
        ResponseEntity.BodyBuilder response = ResponseEntity.status(HttpStatus.CREATED);
        if (joined.accessToken() != null) {
            response.header(HttpHeaders.SET_COOKIE, guestCookie.set(joined.accessToken(), joined.expiresIn()));
        }
        return response.body(joined);
    }

    private <T> T guarded(HttpServletRequest http, Supplier<T> action) {
        String address = http.getRemoteAddr();
        rateLimiter.checkNotLockedOut(RateLimit.JOIN_BAD_CODES_PER_IP, address);
        rateLimiter.check(RateLimit.JOIN_PER_IP, address);
        try {
            return action.get();
        } catch (ApiException e) {
            if (e.getCode() == ErrorCode.INVALID_CODE) {
                rateLimiter.record(RateLimit.JOIN_BAD_CODES_PER_IP, address);
            }
            throw e;
        }
    }
}
