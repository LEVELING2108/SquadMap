package com.squadmap.invite.web;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.error.Problems;
import com.squadmap.invite.dto.JoinResponse;
import com.squadmap.invite.service.JoinService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** A guest's session, kept in the {@link GuestCookie}, so a reload doesn't drop them from their trip. */
@RestController
@RequestMapping("/api/v1/guest")
@Tag(name = "Join")
@SecurityRequirements
public class GuestSessionController {

    private final JoinService joins;
    private final GuestCookie guestCookie;

    public GuestSessionController(JoinService joins, GuestCookie guestCookie) {
        this.joins = joins;
        this.guestCookie = guestCookie;
    }

    @PostMapping("/session")
    @Operation(summary = "Pick up my guest session",
            description = "Uses the guest cookie set when joining. Returns a fresh pass running to the trip's "
                    + "current end, so it also covers an extension. 401 GUEST_SESSION_ENDED clears the cookie.")
    public ResponseEntity<JoinResponse> restore(@CookieValue(name = GuestCookie.NAME, required = false) String pass) {
        JoinResponse session = joins.restoreGuestSession(pass);
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, guestCookie.set(session.accessToken(), session.expiresIn()))
                .body(session);
    }

    @PostMapping("/logout")
    @Operation(summary = "Forget my guest session on this device", description = "Always succeeds.")
    public ResponseEntity<Void> logout() {
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, guestCookie.clear()).build();
    }

    /** A guest session that can't be restored also clears the cookie, so the browser stops sending it. */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ProblemDetail> handle(ApiException ex) {
        ResponseEntity.BodyBuilder response = Problems.responseFor(ex);
        if (ex.getCode() == ErrorCode.GUEST_SESSION_ENDED) {
            response.header(HttpHeaders.SET_COOKIE, guestCookie.clear());
        }
        return response.body(Problems.bodyFor(ex));
    }
}
