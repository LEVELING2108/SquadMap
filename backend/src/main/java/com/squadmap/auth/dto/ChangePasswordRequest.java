package com.squadmap.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ChangePasswordRequest(
        @NotBlank(message = "Enter your current password.")
        @Size(max = 128, message = "That isn't your current password.")
        String currentPassword,

        @NotNull(message = "Enter a new password.")
        @Size(min = 8, max = 128, message = "Use between 8 and 128 characters.")
        String newPassword) {

    @Override
    public String toString() {
        return "ChangePasswordRequest[***]";
    }
}
