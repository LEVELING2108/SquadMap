package com.squadmap.notify.push;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * A browser's push subscription, as {@code PushSubscription.toJSON()} gives it.
 *
 * @param endpoint the push service address for this device
 * @param keys     the browser's encryption keys
 */
public record SubscribeRequest(
        @NotBlank(message = "Give the push address.") @Size(max = 1024, message = "The push address is too long.")
        String endpoint,
        @NotNull(message = "Give the keys.") @Valid Keys keys,
        // Browsers add this; it is accepted and not used.
        Long expirationTime) {

    /**
     * @param p256dh the browser's public key, base64url
     * @param auth   the auth secret, base64url
     */
    public record Keys(
            @NotBlank(message = "Give the p256dh key.") @Size(max = 100, message = "The p256dh key is too long.")
            @Pattern(regexp = "[A-Za-z0-9_=-]+", message = "The p256dh key must be base64url.") String p256dh,
            @NotBlank(message = "Give the auth secret.") @Size(max = 40, message = "The auth secret is too long.")
            @Pattern(regexp = "[A-Za-z0-9_=-]+", message = "The auth secret must be base64url.") String auth) {
    }
}
