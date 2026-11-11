package com.squadmap.common.security;

/**
 * What an access token stands for, carried in its {@code kind} claim.
 * A token's kind decides which routes it may call, so a token issued for one purpose
 * can never be used for another.
 */
public enum TokenKind {

    /** A signed-in account. */
    USER("user", "ROLE_USER"),

    /** A guest on a single trip: no account, access limited to that trip. */
    GUEST("guest", "ROLE_GUEST");

    public static final String CLAIM = "kind";

    private final String claimValue;
    private final String authority;

    TokenKind(String claimValue, String authority) {
        this.claimValue = claimValue;
        this.authority = authority;
    }

    public String claimValue() {
        return claimValue;
    }

    public String authority() {
        return authority;
    }

    /** @return the kind for a claim value, or {@code null} when the value is unknown or missing */
    public static TokenKind fromClaim(Object value) {
        for (TokenKind kind : values()) {
            if (kind.claimValue.equals(value)) {
                return kind;
            }
        }
        return null;
    }
}
