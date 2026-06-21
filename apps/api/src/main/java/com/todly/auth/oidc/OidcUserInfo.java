package com.todly.auth.oidc;

/**
 * Normalized identity extracted from a verified OIDC id token.
 *
 * @param subject       the provider's stable user id (the {@code sub} claim)
 * @param email         the user's email (may be null if not provided)
 * @param emailVerified whether the provider asserts the email is verified
 * @param name          display name, if available
 */
public record OidcUserInfo(String subject, String email, boolean emailVerified, String name) {
}
