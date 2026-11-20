package com.squadmap.notify.push;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;
import java.util.List;

/**
 * @param publicKey     VAPID public key, base64url (65 bytes). With {@code privateKey}, identifies this server
 *                      to push services. When both are empty outside production, a temporary pair is made at
 *                      startup, and phones must turn notifications on again after each restart.
 * @param privateKey    VAPID private key, base64url (32 bytes)
 * @param subject       a contact for push services, {@code mailto:} or {@code https:}
 * @param allowedHosts  push service hosts the server will send to, matched on the host's end. A subscription
 *                      names the address to send to, so this keeps the server from posting anywhere else.
 * @param allowHttp     accept plain-HTTP push addresses; only tests turn this on
 * @param timeout       how long to wait for a push service
 */
@ConfigurationProperties("squadmap.push")
public record PushProperties(
        @DefaultValue("") String publicKey,
        @DefaultValue("") String privateKey,
        @DefaultValue("mailto:no-reply@squadmap.local") String subject,
        @DefaultValue({"fcm.googleapis.com", "push.services.mozilla.com", "push.apple.com",
                "notify.windows.com"}) List<String> allowedHosts,
        @DefaultValue("false") boolean allowHttp,
        @DefaultValue("10s") Duration timeout) {
}
