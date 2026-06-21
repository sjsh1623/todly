package com.todly.common;

import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

/**
 * Reads the authenticated user id (a {@link UUID}) from the
 * {@link SecurityContextHolder}. The {@code JwtAuthenticationFilter} sets the
 * principal to the user id UUID on a valid Bearer token.
 */
public final class CurrentUser {

    private CurrentUser() {}

    /** @return the authenticated user id, or throw 401 if unauthenticated. */
    public static UUID id() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null && auth.getPrincipal() instanceof UUID userId) {
            return userId;
        }
        throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication required");
    }
}
