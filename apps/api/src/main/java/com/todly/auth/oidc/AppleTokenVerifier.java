package com.todly.auth.oidc;

import com.todly.user.OauthProvider;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Verifies Apple-issued OIDC id tokens against Apple's published JWKS.
 *
 * <p>Note: Apple only includes the user's name in the very first authorization
 * response (not in the id token), so {@code name} is typically null here.
 */
@Component
public class AppleTokenVerifier extends JwksOidcVerifier {

    private static final String JWKS = "https://appleid.apple.com/auth/keys";
    private static final String ISSUER = "https://appleid.apple.com";

    public AppleTokenVerifier(@Value("${todly.oidc.apple-client-id:}") String clientId) {
        super(JWKS, ISSUER, clientId);
    }

    @Override
    public OauthProvider provider() {
        return OauthProvider.apple;
    }

    @Override
    protected OidcUserInfo map(Claims claims) {
        Object verified = claims.get("email_verified");
        boolean emailVerified = verified == null
            || (verified instanceof Boolean b ? b : Boolean.parseBoolean(String.valueOf(verified)));
        return new OidcUserInfo(
            claims.getSubject(),
            claims.get("email", String.class),
            emailVerified,
            null);
    }
}
