package com.squadmap.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record LoginRequest(
        @NotBlank(message = "Enter your email.")
        @Size(max = 254, message = "Enter a valid email address.")
        String email,

        @NotNull(message = "Enter your password.")
        @Size(min = 1, max = 128, message = "Enter your password.")
        String password) {

    /** Spaces around a pasted email are not a reason to reject it, so they go before validation. */
    public LoginRequest {
        email = email == null ? null : email.strip();
    }

    /** Keeps the password out of logs if the request is ever printed. */
    @Override
    public String toString() {
        return "LoginRequest[password=***]";
    }
}
