package com.squadmap.user.web;

import com.squadmap.common.error.ApiException;
import com.squadmap.common.error.ErrorCode;
import com.squadmap.common.security.CurrentUser;
import com.squadmap.user.dto.UserResponse;
import com.squadmap.user.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/me")
@Tag(name = "Me")
public class MeController {

    private final UserService users;

    public MeController(UserService users) {
        this.users = users;
    }

    @GetMapping
    @Operation(summary = "The signed-in person's profile")
    public UserResponse me(@AuthenticationPrincipal Jwt token) {
        return users.findActiveById(CurrentUser.id(token))
                .map(UserResponse::from)
                // A valid token for an account that no longer exists: treat as signed out.
                .orElseThrow(() -> new ApiException(
                        HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED, "Sign in to continue."));
    }
}
