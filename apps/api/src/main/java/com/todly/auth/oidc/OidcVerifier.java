package com.todly.auth.oidc;

import com.todly.user.OauthProvider;

/**
 * Verifies a provider-issued OIDC id token and returns the normalized identity.
 *
 * <p>Implementations fetch the provider's JWKS lazily (at first verification),
 * never at application startup, so the app boots and tests run fully offline.
 */
public interface OidcVerifier {

    /** Which provider this verifier handles. */
    OauthProvider provider();

    /**
     * Verify the id token's signature, issuer, audience and expiry, returning the
     * claims of interest.
     *
     * @throws com.todly.common.ApiException (401 INVALID_TOKEN) on any failure.
     */
    OidcUserInfo verify(String idToken);
}
