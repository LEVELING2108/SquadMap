package com.squadmap.notify.push;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.KeyPair;
import java.security.Signature;

@Configuration
@EnableConfigurationProperties(PushProperties.class)
public class PushConfig {

    private static final Logger log = LoggerFactory.getLogger(PushConfig.class);

    @Bean
    Vapid vapid(PushProperties properties, Environment environment) {
        boolean hasPublic = !properties.publicKey().isBlank();
        boolean hasPrivate = !properties.privateKey().isBlank();
        if (!hasPublic && !hasPrivate) {
            if (environment.acceptsProfiles(Profiles.of("prod"))) {
                throw new IllegalStateException("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must be set in production.");
            }
            log.warn("No push keys configured; using temporary ones. Notifications must be turned on again "
                    + "after a restart. Make a pair with: node infra/scripts/vapid-keys.mjs");
            return new Vapid(EcKeys.generate(), properties.subject());
        }
        if (!hasPublic || !hasPrivate) {
            throw new IllegalStateException("Set both push keys, or neither.");
        }
        KeyPair keys;
        try {
            keys = new KeyPair(EcKeys.publicKey(EcKeys.unbase64(properties.publicKey())),
                    EcKeys.privateKey(EcKeys.unbase64(properties.privateKey())));
        } catch (IllegalArgumentException e) {
            // The message says which setting is wrong, never its value.
            throw new IllegalStateException("The push keys are not a valid P-256 key pair in base64url.");
        }
        if (!matching(keys)) {
            throw new IllegalStateException("VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY are not from the same pair.");
        }
        return new Vapid(keys, properties.subject());
    }

    private static boolean matching(KeyPair keys) {
        try {
            byte[] probe = "squadmap".getBytes(StandardCharsets.US_ASCII);
            Signature signer = Signature.getInstance("SHA256withECDSA");
            signer.initSign(keys.getPrivate());
            signer.update(probe);
            byte[] signed = signer.sign();
            Signature verifier = Signature.getInstance("SHA256withECDSA");
            verifier.initVerify(keys.getPublic());
            verifier.update(probe);
            return verifier.verify(signed);
        } catch (GeneralSecurityException e) {
            return false;
        }
    }
}
