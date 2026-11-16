package com.squadmap.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** @param password the current password, to confirm it's really the account's owner */
public record ChangeEmailRequest(
        @NotBlank(message = "Enter the new email.")
        @Email(message = "Enter a valid email address.")
        @Size(max = 254, message = "Enter a valid email address.")
        String email,

        @NotBlank(message = "Enter your password.")
        @Size(max = 128, message = "That isn't your current password.")
        String password) {

    @Override
    public String toString() {
        return "ChangeEmailRequest[***]";
    }
}
