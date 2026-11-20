package com.squadmap.notify.push;

import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.common.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/me/push")
@Tag(name = "Push notifications")
public class PushController {

    private final PushService push;
    private final Vapid vapid;
    private final RateLimiter rateLimiter;

    public PushController(PushService push, Vapid vapid, RateLimiter rateLimiter) {
        this.push = push;
        this.vapid = vapid;
        this.rateLimiter = rateLimiter;
    }

    @GetMapping("/key")
    @Operation(summary = "The key to subscribe with",
            description = "Pass it as applicationServerKey to pushManager.subscribe().")
    public Map<String, String> key() {
        return Map.of("publicKey", vapid.publicKey());
    }

    @PostMapping("/subscribe")
    @Operation(summary = "Turn push on for this device",
            description = "Send the browser's push subscription. Sending it again is fine. Each account keeps "
                    + "up to 10 devices; an 11th replaces the oldest. Which alerts are pushed is chosen in "
                    + "settings (pushJoined, pushLeft, pushEndingSoon, pushTripEnded).")
    public ResponseEntity<Void> subscribe(@AuthenticationPrincipal Jwt token,
                                          @Valid @RequestBody SubscribeRequest request) {
        UUID userId = CurrentUser.id(token);
        rateLimiter.check(RateLimit.PUSH_SUBSCRIBE_PER_USER, userId.toString());
        push.subscribe(userId, request);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/unsubscribe")
    @Operation(summary = "Turn push off for this device", description = "Also called when signing out.")
    public ResponseEntity<Void> unsubscribe(@AuthenticationPrincipal Jwt token,
                                            @Valid @RequestBody UnsubscribeRequest request) {
        UUID userId = CurrentUser.id(token);
        rateLimiter.check(RateLimit.PUSH_SUBSCRIBE_PER_USER, userId.toString());
        push.unsubscribe(userId, request.endpoint());
        return ResponseEntity.noContent().build();
    }
}
