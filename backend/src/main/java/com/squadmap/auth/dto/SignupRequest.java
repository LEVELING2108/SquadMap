package com.squadmap.auth.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record SignupRequest(
        @NotBlank(message = "Enter your name.")
        @Size(max = 60, message = "Use 60 characters or fewer.")
        String name,

        @NotBlank(message = "Enter your email.")
        @Email(message = "Enter a valid email address.")
        @Size(max = 254, message = "Enter a valid email address.")
        String email,

        // The upper bound stops very long inputs from being used to tie up the password hasher.
        @NotNull(message = "Enter a password.")
        @Size(min = 8, max = 128, message = "Use between 8 and 128 characters.")
        String password,

        @AssertTrue(message = "Agree to the Terms and Privacy Policy to continue.")
        boolean acceptedTerms) {

    /** Spaces around a pasted email are not a reason to reject it, so they go before validation. */
    public SignupRequest {
        email = email == null ? null : email.strip();
    }

    /** Keeps the password out of logs if the request is ever printed. */
    @Override
    public String toString() {
        return "SignupRequest[password=***]";
    }
}
