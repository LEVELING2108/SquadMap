package com.squadmap.auth.web;

import com.squadmap.auth.dto.AuthResponse;
import com.squadmap.auth.dto.LoginRequest;
import com.squadmap.auth.dto.SignupRequest;
import com.squadmap.auth.service.AuthService;
import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.error.Problems;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
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

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth")
@SecurityRequirements // public: no bearer token needed
public class AuthController {

    private final AuthService auth;
    private final RefreshCookie refreshCookie;

    public AuthController(AuthService auth, RefreshCookie refreshCookie) {
        this.auth = auth;
        this.refreshCookie = refreshCookie;
    }

    @PostMapping("/signup")
    @Operation(summary = "Create an account and sign in",
            description = "Returns an access token and sets the refresh cookie.")
    public ResponseEntity<AuthResponse> signup(@Valid @RequestBody SignupRequest request) {
        return signedIn(HttpStatus.CREATED, auth.signup(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Sign in with email and password",
            description = "Returns an access token and sets the refresh cookie.")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return signedIn(HttpStatus.OK, auth.login(request));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Get a new access token",
            description = "Uses the refresh cookie, which is replaced by a new one on every call.")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = RefreshCookie.NAME, required = false) String token) {
        return signedIn(HttpStatus.OK, auth.refresh(token));
    }

    @PostMapping("/logout")
    @Operation(summary = "End this session", description = "Always succeeds and clears the refresh cookie.")
    public ResponseEntity<Void> logout(@CookieValue(name = RefreshCookie.NAME, required = false) String token) {
        auth.logout(token);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, refreshCookie.clear()).build();
    }

    /** A rejected refresh also clears the cookie, so the browser stops sending a dead token. */
    @ExceptionHandler(ApiException.class)
    public ResponseEntity<ProblemDetail> handle(ApiException ex) {
        ResponseEntity.BodyBuilder response = ResponseEntity.status(ex.getStatus());
        if (ex.getCode() == ErrorCode.SESSION_EXPIRED) {
            response.header(HttpHeaders.SET_COOKIE, refreshCookie.clear());
        }
        return response.body(Problems.of(ex.getStatus(), ex.getCode(), ex.getMessage()));
    }

    private ResponseEntity<AuthResponse> signedIn(HttpStatus status, AuthService.SignedIn signedIn) {
        return ResponseEntity.status(status)
                .header(HttpHeaders.SET_COOKIE, refreshCookie.set(signedIn.refreshToken()))
                .body(signedIn.response());
    }
}
