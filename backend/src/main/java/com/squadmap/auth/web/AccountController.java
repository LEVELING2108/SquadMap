package com.squadmap.auth.web;

import com.squadmap.auth.dto.ChangeEmailRequest;
import com.squadmap.auth.dto.ChangePasswordRequest;
import com.squadmap.auth.dto.DeleteAccountRequest;
import com.squadmap.auth.service.AccountService;
import com.squadmap.common.security.CurrentUser;
import com.squadmap.user.dto.UserResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * A signed-in person securing their account. The password and session routes sit under /auth because
 * only those receive the refresh cookie, which tells which session to keep.
 */
@RestController
@Tag(name = "Account")
public class AccountController {

    private final AccountService accounts;

    public AccountController(AccountService accounts) {
        this.accounts = accounts;
    }

    @PostMapping("/api/v1/auth/password")
    @Operation(summary = "Change my password",
            description = "Needs the current password. Ends every other session; this device stays signed in. "
                    + "Five wrong passwords in 15 minutes pause further tries.")
    public ResponseEntity<Void> changePassword(
            @AuthenticationPrincipal Jwt token, @Valid @RequestBody ChangePasswordRequest request,
            @CookieValue(name = RefreshCookie.NAME, required = false) String session) {
        accounts.changePassword(CurrentUser.id(token), request.currentPassword(), request.newPassword(), session);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/api/v1/auth/logout-others")
    @Operation(summary = "Log out everywhere else", description = "Ends every session except this device's.")
    public ResponseEntity<Void> logoutOthers(
            @AuthenticationPrincipal Jwt token,
            @CookieValue(name = RefreshCookie.NAME, required = false) String session) {
        accounts.endOtherSessions(CurrentUser.id(token), session);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/v1/me")
    @Operation(summary = "Delete my account",
            description = "Needs the current password (five wrong ones in 15 minutes pause further tries). "
                    + "Straight away: trips I host end, I leave the others, every session ends and push stops; "
                    + "an email confirms it. The data is removed 30 days later unless I log in again before "
                    + "then, which keeps the account. Trips stay in friends' history with my name replaced.")
    public Map<String, Instant> deleteAccount(@AuthenticationPrincipal Jwt token,
                                              @Valid @RequestBody DeleteAccountRequest request) {
        return Map.of("removeAt", accounts.deleteAccount(CurrentUser.id(token), request.password()));
    }

    @PutMapping("/api/v1/me/email")
    @Operation(summary = "Change my email",
            description = "Needs the current password. The old address gets a notice. 409 EMAIL_TAKEN when "
                    + "another account uses the new one.")
    public UserResponse changeEmail(@AuthenticationPrincipal Jwt token, @Valid @RequestBody ChangeEmailRequest request) {
        return UserResponse.from(accounts.changeEmail(CurrentUser.id(token), request.email(), request.password()));
    }
}
