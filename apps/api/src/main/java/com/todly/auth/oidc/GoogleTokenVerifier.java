package com.todly.auth.oidc;

import com.todly.user.OauthProvider;
import io.jsonwebtoken.Claims;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Verifies Google-issued OIDC id tokens against Google's published JWKS.
 * JWKS endpoint and issuer per the Google OpenID configuration.
 */
@Component
public class GoogleTokenVerifier extends JwksOidcVerifier {

    private static final String JWKS = "https://www.googleapis.com/oauth2/v3/certs";
    private static final String ISSUER = "https://accounts.google.com";

    public GoogleTokenVerifier(@Value("${todly.oidc.google-client-id:}") String clientId) {
        super(JWKS, ISSUER, clientId);
    }

    @Override
    public OauthProvider provider() {
        return OauthProvider.google;
    }

    @Override
    protected OidcUserInfo map(Claims claims) {
        Object verified = claims.get("email_verified");
        boolean emailVerified = verified instanceof Boolean b ? b
            : Boolean.parseBoolean(String.valueOf(verified));
        return new OidcUserInfo(
            claims.getSubject(),
            claims.get("email", String.class),
            emailVerified,
            claims.get("name", String.class));
    }
}
