package com.squadmap.notify.push;

import java.math.BigInteger;
import java.security.GeneralSecurityException;
import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.security.spec.ECParameterSpec;
import java.security.spec.ECPoint;
import java.security.spec.ECPrivateKeySpec;
import java.security.spec.ECPublicKeySpec;
import java.util.Arrays;
import java.util.Base64;

/**
 * P-256 keys in the raw forms Web Push uses: a public key is the 65-byte uncompressed point
 * (0x04, then x and y), a private key is the 32-byte number. Both travel as unpadded base64url.
 */
final class EcKeys {

    private static final int COORDINATE = 32;
    private static final ECParameterSpec P256 = p256();

    private EcKeys() {
    }

    static KeyPair generate() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("EC");
            generator.initialize(new ECGenParameterSpec("secp256r1"));
            return generator.generateKeyPair();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("P-256 keys are not available", e);
        }
    }

    static byte[] raw(ECPublicKey key) {
        byte[] out = new byte[1 + 2 * COORDINATE];
        out[0] = 0x04;
        fixed(key.getW().getAffineX(), out, 1);
        fixed(key.getW().getAffineY(), out, 1 + COORDINATE);
        return out;
    }

    static byte[] raw(ECPrivateKey key) {
        byte[] out = new byte[COORDINATE];
        fixed(key.getS(), out, 0);
        return out;
    }

    /** @throws IllegalArgumentException when the bytes aren't an uncompressed P-256 point */
    static ECPublicKey publicKey(byte[] raw) {
        if (raw.length != 1 + 2 * COORDINATE || raw[0] != 0x04) {
            throw new IllegalArgumentException("Not an uncompressed P-256 public key");
        }
        BigInteger x = new BigInteger(1, Arrays.copyOfRange(raw, 1, 1 + COORDINATE));
        BigInteger y = new BigInteger(1, Arrays.copyOfRange(raw, 1 + COORDINATE, raw.length));
        try {
            return (ECPublicKey) KeyFactory.getInstance("EC")
                    .generatePublic(new ECPublicKeySpec(new ECPoint(x, y), P256));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Not a P-256 public key", e);
        }
    }

    static ECPrivateKey privateKey(byte[] raw) {
        if (raw.length != COORDINATE) {
            throw new IllegalArgumentException("Not a P-256 private key");
        }
        try {
            return (ECPrivateKey) KeyFactory.getInstance("EC")
                    .generatePrivate(new ECPrivateKeySpec(new BigInteger(1, raw), P256));
        } catch (GeneralSecurityException e) {
            throw new IllegalArgumentException("Not a P-256 private key", e);
        }
    }

    static String base64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** Reads base64url with or without padding. */
    static byte[] unbase64(String text) {
        return Base64.getUrlDecoder().decode(text.trim());
    }

    private static void fixed(BigInteger value, byte[] out, int offset) {
        byte[] bytes = value.toByteArray();
        // toByteArray may add a leading zero for the sign, or be shorter than 32 bytes.
        int length = Math.min(bytes.length, COORDINATE);
        System.arraycopy(bytes, bytes.length - length, out, offset + COORDINATE - length, length);
    }

    private static ECParameterSpec p256() {
        return ((ECPublicKey) generate().getPublic()).getParams();
    }
}
