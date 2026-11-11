package com.squadmap.auth.web;

import com.squadmap.auth.dto.AuthResponse;
import com.squadmap.auth.dto.LoginRequest;
import com.squadmap.auth.dto.SignupRequest;
import com.squadmap.auth.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.security.SecurityRequirements;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Auth")
@SecurityRequirements // public: no bearer token needed
public class AuthController {

    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Create an account and sign in")
    public AuthResponse signup(@Valid @RequestBody SignupRequest request) {
        return auth.signup(request);
    }

    @PostMapping("/login")
    @Operation(summary = "Sign in with email and password")
    public AuthResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request);
    }
}
