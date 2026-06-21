package com.todly.auth;

import com.todly.common.ApiException;
import com.todly.user.RefreshToken;
import com.todly.user.RefreshTokenRepository;
import com.todly.user.User;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;

/**
 * Mints the access + opaque-refresh token pair and implements refresh-token
 * rotation. Refresh tokens are random 256-bit strings; only their SHA-256 hash
 * is persisted in {@code refresh_tokens}.
 */
@Service
public class TokenService {

    private final JwtProvider jwtProvider;
    private final RefreshTokenRepository refreshTokenRepository;
    private final long refreshTtlSeconds;
    private final SecureRandom random = new SecureRandom();

    public TokenService(JwtProvider jwtProvider,
                        RefreshTokenRepository refreshTokenRepository,
                        JwtProperties props) {
        this.jwtProvider = jwtProvider;
        this.refreshTokenRepository = refreshTokenRepository;
        this.refreshTtlSeconds = props.getRefreshTtlSeconds();
    }

    /** Token pair returned to the client. */
    public record TokenPair(String accessToken, String refreshToken) {}

    /** Issue a fresh access token + a new persisted refresh token for the user. */
    @Transactional
    public TokenPair issuePair(User user) {
        String access = jwtProvider.createAccessToken(user.getId(), user.getUsername(), user.getEmail());
        String rawRefresh = generateRawRefreshToken();

        RefreshToken entity = new RefreshToken();
        entity.setUserId(user.getId());
        entity.setTokenHash(sha256(rawRefresh));
        entity.setExpiresAt(OffsetDateTime.now().plusSeconds(refreshTtlSeconds));
        refreshTokenRepository.save(entity);

        return new TokenPair(access, rawRefresh);
    }

    /**
     * Look up a refresh token by its hash, validating it is neither revoked nor
     * expired. Throws 401 INVALID_TOKEN otherwise.
     */
    @Transactional(readOnly = true)
    public RefreshToken validateRefreshToken(String rawRefresh) {
        RefreshToken stored = refreshTokenRepository.findByTokenHash(sha256(rawRefresh))
            .orElseThrow(() -> ApiException.invalidToken("Refresh token not found"));
        if (stored.getRevokedAt() != null) {
            throw ApiException.invalidToken("Refresh token has been revoked");
        }
        if (stored.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw ApiException.invalidToken("Refresh token has expired");
        }
        return stored;
    }

    /** Revoke the refresh token identified by its raw value (idempotent). */
    @Transactional
    public void revoke(String rawRefresh) {
        refreshTokenRepository.findByTokenHash(sha256(rawRefresh)).ifPresent(rt -> {
            if (rt.getRevokedAt() == null) {
                rt.setRevokedAt(OffsetDateTime.now());
                refreshTokenRepository.save(rt);
            }
        });
    }

    private String generateRawRefreshToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return UUID.randomUUID() + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
            return Base64.getEncoder().encodeToString(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
