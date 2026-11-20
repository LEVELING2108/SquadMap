package com.squadmap.notify.push;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** @param endpoint the push address this device subscribed with */
public record UnsubscribeRequest(
        @NotBlank(message = "Give the push address.") @Size(max = 1024, message = "The push address is too long.")
        String endpoint) {
}
