package com.todly.auth;

import com.todly.common.ApiException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * Issues and verifies HS256-signed access tokens.
 *
 * <p>The access token subject is the user id (UUID); it additionally carries
 * {@code username} and {@code email} claims. Refresh tokens are NOT JWTs — they
 * are opaque random strings handled by {@link AuthService} / {@link TokenService}.
 */
@Component
public class JwtProvider {

    private final SecretKey key;
    private final long accessTtlSeconds;

    public JwtProvider(JwtProperties props) {
        byte[] secretBytes = props.getSecret() == null
            ? new byte[0]
            : props.getSecret().getBytes(StandardCharsets.UTF_8);
        if (secretBytes.length < 32) {
            throw new IllegalStateException(
                "todly.jwt.secret must be at least 32 bytes (256 bits) for HS256; "
                    + "set the JWT_SECRET environment variable.");
        }
        this.key = Keys.hmacShaKeyFor(secretBytes);
        this.accessTtlSeconds = props.getAccessTtlSeconds();
    }

    /** Issue a signed access token for the given user. */
    public String createAccessToken(UUID userId, String username, String email) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(accessTtlSeconds);
        return Jwts.builder()
            .subject(userId.toString())
            .claim("username", username)
            .claim("email", email)
            .issuedAt(Date.from(now))
            .expiration(Date.from(exp))
            .signWith(key)
            .compact();
    }

    /**
     * Parse and validate an access token, returning its claims.
     *
     * @throws ApiException (401 INVALID_TOKEN) when the token is malformed,
     *                      tampered with, or expired.
     */
    public Claims parse(String token) {
        try {
            return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
        } catch (JwtException | IllegalArgumentException ex) {
            throw ApiException.invalidToken("Invalid or expired access token");
        }
    }

    /** Extract the user id (subject) from a valid access token. */
    public UUID getUserId(String token) {
        return UUID.fromString(parse(token).getSubject());
    }

    public long getAccessTtlSeconds() {
        return accessTtlSeconds;
    }
}
