package com.squadmap.notify.alert;

import com.squadmap.common.security.CurrentUser;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/me/alerts")
@Tag(name = "Alerts")
public class AlertController {

    private final AlertService alerts;

    public AlertController(AlertService alerts) {
        this.alerts = alerts;
    }

    @GetMapping
    @Operation(summary = "My alerts", description = "Newest first, with the unread count. Kept for 30 days. "
            + "Pass the previous page's nextBefore as `before` for older ones.")
    public AlertPage list(@AuthenticationPrincipal Jwt token,
                          @RequestParam(required = false) UUID before,
                          @RequestParam(defaultValue = "30")
                          @Min(value = 1, message = "Ask for at least 1.")
                          @Max(value = 50, message = "Ask for 50 or fewer.") int limit) {
        return alerts.page(CurrentUser.id(token), before, limit);
    }

    @GetMapping("/unread-count")
    @Operation(summary = "How many of my alerts are unread", description = "For the badge on the Alerts tab.")
    public Map<String, Long> unreadCount(@AuthenticationPrincipal Jwt token) {
        return Map.of("unread", alerts.unreadCount(CurrentUser.id(token)));
    }

    @PostMapping("/{alertId}/read")
    @Operation(summary = "Mark one alert read")
    public ResponseEntity<Void> markRead(@AuthenticationPrincipal Jwt token, @PathVariable UUID alertId) {
        alerts.markRead(CurrentUser.id(token), alertId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/read-all")
    @Operation(summary = "Mark all my alerts read")
    public ResponseEntity<Void> markAllRead(@AuthenticationPrincipal Jwt token) {
        alerts.markAllRead(CurrentUser.id(token));
        return ResponseEntity.noContent().build();
    }
}
