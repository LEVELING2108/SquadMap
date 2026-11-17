package com.squadmap.location.web;

import com.squadmap.common.security.Caller;

import java.security.Principal;
import java.time.Instant;

/**
 * Who opened a live connection, from the access token sent with STOMP CONNECT.
 *
 * @param expiresAt when that token runs out; after it, the connection must sign in again
 */
public record LivePrincipal(Caller caller, Instant expiresAt) implements Principal {

    @Override
    public String getName() {
        return caller.kind().claimValue() + ":" + caller.subject();
    }
}
