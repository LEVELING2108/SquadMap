package com.squadmap.auth.web;

import com.squadmap.auth.dto.AuthResponse;
import com.squadmap.auth.dto.ForgotPasswordRequest;
import com.squadmap.auth.dto.LoginRequest;
import com.squadmap.auth.dto.ResetPasswordRequest;
import com.squadmap.auth.dto.SignupRequest;
import com.squadmap.auth.service.AuthService;
import com.squadmap.auth.service.PasswordResetService;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.error.Problems;
import com.squadmap.common.ratelimit.RateLimit;
import com.squadmap.common.ratelimit.RateLimiter;
import com.squadmap.common.text.Text;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Public account routes. Each one is rate limited (see {@link RateLimit}) before any work is done.
 * The client address comes from {@code X-Forwarded-For}, so the proxy in front of the app must
 * overwrite that header rather than append to it.
 */
@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth")
@SecurityRequirements // public: no bearer token needed
public class AuthController {

    private final AuthService auth;
    private final PasswordResetService passwordReset;
    private final RefreshCookie refreshCookie;
    private final RateLimiter rateLimiter;

    public AuthController(AuthService auth, PasswordResetService passwordReset, RefreshCookie refreshCookie,
                          RateLimiter rateLimiter) {
        this.auth = auth;
        this.passwordReset = passwordReset;
        this.refreshCookie = refreshCookie;
        this.rateLimiter = rateLimiter;
    }

    @PostMapping("/signup")
    @Operation(summary = "Create an account and sign in",
            description = "Returns an access token and sets the refresh cookie.")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request, HttpServletRequest http) {
        rateLimiter.check(RateLimit.SIGNUP_PER_IP, http.getRemoteAddr());
        return signedIn(HttpStatus.CREATED, auth.signup(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Sign in with email and password",
            description = "Returns an access token and sets the refresh cookie.")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        rateLimiter.check(RateLimit.LOGIN_PER_IP, http.getRemoteAddr());
        rateLimiter.check(RateLimit.LOGIN_PER_ACCOUNT, Text.normalizeEmail(request.email()));
        return signedIn(HttpStatus.OK, auth.login(request));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Get a new access token",
            description = "Uses the refresh cookie, which is replaced by a new one on every call.")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = RefreshCookie.NAME, required = false) String token, HttpServletRequest http) {
        rateLimiter.check(RateLimit.REFRESH_PER_IP, http.getRemoteAddr());
        return signedIn(HttpStatus.OK, auth.refresh(token));
    }

    @PostMapping("/logout")
    @Operation(summary = "End this session", description = "Always succeeds and clears the refresh cookie.")
    public ResponseEntity<Void> logout(@CookieValue(name = RefreshCookie.NAME, required = false) String token) {
        auth.logout(token);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, refreshCookie.clear()).build();
    }

    @PostMapping("/forgot")
    @Operation(summary = "Email a link for choosing a new password",
            description = "Answers 202 straight away whether or not the email has an account.")
    public ResponseEntity<Void> forgot(@Valid @RequestBody ForgotPasswordRequest request, HttpServletRequest http) {
        rateLimiter.check(RateLimit.FORGOT_PER_IP, http.getRemoteAddr());
        // Counted for every address, registered or not, so the limit itself reveals nothing.
        rateLimiter.check(RateLimit.FORGOT_PER_EMAIL, Text.normalizeEmail(request.email()));
        passwordReset.requestLink(request.email());
        return ResponseEntity.accepted().build();
    }

    @PostMapping("/reset")
    @Operation(summary = "Set a new password with the emailed link",
            description = "Signs the account out on every device.")
    public ResponseEntity<Void> reset(@Valid @RequestBody ResetPasswordRequest request, HttpServletRequest http) {
        rateLimiter.check(RateLimit.RESET_PER_IP, http.getRemoteAddr());
        passwordReset.resetPassword(request.token(), request.password());
        return ResponseEntity.noContent().build();
    }

    /** A rejected refresh also clears the cookie, so the browser stops sending a dead token. */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ProblemDetail> handle(ApiException ex) {
        ResponseEntity.BodyBuilder response = Problems.responseFor(ex);
        if (ex.getCode() == ErrorCode.SESSION_EXPIRED) {
            response.header(HttpHeaders.SET_COOKIE, refreshCookie.clear());
        }
        return response.body(Problems.bodyFor(ex));
    }

    private ResponseEntity<AuthResponse> signedIn(HttpStatus status, AuthService.SignedIn signedIn) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, refreshCookie.set(signedIn.refreshToken()))
                .body(signedIn.response());
    }
}
