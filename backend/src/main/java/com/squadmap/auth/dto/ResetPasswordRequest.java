package com.squadmap.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ResetPasswordRequest(
        @NotBlank(message = "This reset link is incomplete. Open it again from the email.")
        @Size(max = 100, message = "This reset link is incomplete. Open it again from the email.")
        String token,

        @NotNull(message = "Enter a new password.")
        @Size(min = 8, max = 128, message = "Use between 8 and 128 characters.")
        String password) {

    /** Keeps the token and password out of logs if the request is ever printed. */
    @Override
    public String toString() {
        return "ResetPasswordRequest[token=***, password=***]";
    }
}
