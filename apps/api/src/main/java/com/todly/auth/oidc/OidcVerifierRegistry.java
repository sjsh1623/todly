package com.todly.auth.oidc;

import com.todly.common.ApiException;
import com.todly.user.OauthProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * Resolves an {@link OidcVerifier} by provider. All discovered verifier beans
 * are registered automatically, so adding a new provider is just adding a bean.
 */
@Component
public class OidcVerifierRegistry {

    private final Map<OauthProvider, OidcVerifier> verifiers = new EnumMap<>(OauthProvider.class);

    public OidcVerifierRegistry(List<OidcVerifier> beans) {
        for (OidcVerifier v : beans) {
            verifiers.put(v.provider(), v);
        }
    }

    public OidcVerifier get(OauthProvider provider) {
        OidcVerifier v = verifiers.get(provider);
        if (v == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_PROVIDER",
                "Unsupported OAuth provider: " + provider);
        }
        return v;
    }
}
