package com.todly.auth;

import com.todly.common.ApiException;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtProviderTest {

    private JwtProvider providerWithTtl(long ttlSeconds) {
        JwtProperties props = new JwtProperties();
        props.setSecret("test-secret-test-secret-test-secret-0123456789"); // >= 32 bytes
        props.setAccessTtlSeconds(ttlSeconds);
        return new JwtProvider(props);
    }

    @Test
    void signsAndVerifiesWithClaims() {
        JwtProvider provider = providerWithTtl(900);
        UUID userId = UUID.randomUUID();
        String token = provider.createAccessToken(userId, "octocat", "octo@todly.dev");

        Claims claims = provider.parse(token);
        assertThat(claims.getSubject()).isEqualTo(userId.toString());
        assertThat(claims.get("username", String.class)).isEqualTo("octocat");
        assertThat(claims.get("email", String.class)).isEqualTo("octo@todly.dev");
        assertThat(provider.getUserId(token)).isEqualTo(userId);
    }

    @Test
    void rejectsExpiredToken() {
        JwtProvider provider = providerWithTtl(-10); // already expired
        String token = provider.createAccessToken(UUID.randomUUID(), "u", "u@todly.dev");
        assertThatThrownBy(() -> provider.parse(token))
            .isInstanceOf(ApiException.class)
            .hasMessageContaining("Invalid or expired");
    }

    @Test
    void rejectsTamperedToken() {
        JwtProvider provider = providerWithTtl(900);
        String token = provider.createAccessToken(UUID.randomUUID(), "u", "u@todly.dev");
        String tampered = token.substring(0, token.length() - 2) + "xx";
        assertThatThrownBy(() -> provider.parse(tampered))
            .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsTokenSignedWithDifferentKey() {
        JwtProvider a = providerWithTtl(900);
        JwtProperties other = new JwtProperties();
        other.setSecret("another-secret-another-secret-abcdef-9876543210");
        JwtProvider b = new JwtProvider(other);

        String token = b.createAccessToken(UUID.randomUUID(), "u", "u@todly.dev");
        assertThatThrownBy(() -> a.parse(token))
            .isInstanceOf(ApiException.class);
    }

    @Test
    void rejectsTooShortSecret() {
        JwtProperties props = new JwtProperties();
        props.setSecret("short");
        assertThatThrownBy(() -> new JwtProvider(props))
            .isInstanceOf(IllegalStateException.class)
            .hasMessageContaining("at least 32 bytes");
    }
}
