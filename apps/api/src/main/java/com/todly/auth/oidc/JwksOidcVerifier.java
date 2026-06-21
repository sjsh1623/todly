package com.todly.auth.oidc;

import com.todly.common.ApiException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Jwk;
import io.jsonwebtoken.security.JwkSet;
import io.jsonwebtoken.security.Jwks;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.Key;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Base OIDC verifier that validates an id token against a provider's JWKS.
 *
 * <p>Keys are fetched from the JWKS endpoint lazily on first use and cached;
 * nothing happens at construction time, so the application starts (and tests
 * run) without any network access. When a {@code kid} is not in the cache the
 * JWKS is re-fetched once (handles key rotation).
 */
public abstract class JwksOidcVerifier implements OidcVerifier {

    private final String jwksUri;
    private final String issuer;
    private final String audience;
    private final HttpClient httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build();
    private final AtomicReference<Map<String, Key>> keyCache = new AtomicReference<>();

    protected JwksOidcVerifier(String jwksUri, String issuer, String audience) {
        this.jwksUri = jwksUri;
        this.issuer = issuer;
        this.audience = audience;
    }

    /** Map verified claims to the normalized identity for this provider. */
    protected abstract OidcUserInfo map(Claims claims);

    @Override
    public OidcUserInfo verify(String idToken) {
        if (audience == null || audience.isBlank()) {
            // TODO: configure the provider client id (GOOGLE_CLIENT_ID / APPLE_CLIENT_ID)
            //       before enabling social login in this environment.
            throw new ApiException(org.springframework.http.HttpStatus.NOT_IMPLEMENTED,
                "OIDC_NOT_CONFIGURED",
                "OIDC client id for " + provider() + " is not configured");
        }
        try {
            var parser = Jwts.parser()
                .keyLocator(header -> {
                    String kid = (String) header.get("kid");
                    return resolveKey(kid);
                })
                .requireIssuer(issuer)
                .requireAudience(audience)
                .build();
            Claims claims = parser.parseSignedClaims(idToken).getPayload();
            return map(claims);
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.invalidToken("Invalid " + provider() + " id token");
        }
    }

    private Key resolveKey(String kid) {
        Map<String, Key> cache = keyCache.get();
        if (cache == null || !cache.containsKey(kid)) {
            cache = fetchKeys();
            keyCache.set(cache);
        }
        Key key = cache.get(kid);
        if (key == null) {
            throw ApiException.invalidToken("Unknown signing key");
        }
        return key;
    }

    private Map<String, Key> fetchKeys() {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(jwksUri))
                .timeout(Duration.ofSeconds(5))
                .GET()
                .build();
            HttpResponse<String> response =
                httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            JwkSet set = Jwks.setParser().build().parse(response.body());
            Map<String, Key> keys = new HashMap<>();
            for (Jwk<?> jwk : set.getKeys()) {
                keys.put(jwk.getId(), jwk.toKey());
            }
            return keys;
        } catch (Exception e) {
            throw ApiException.invalidToken("Unable to fetch signing keys for " + provider());
        }
    }
}
