package com.todly.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds {@code todly.jwt.*} configuration.
 * The secret must be at least 32 bytes (256 bits) for HS256.
 */
@ConfigurationProperties(prefix = "todly.jwt")
public class JwtProperties {

    private String secret;
    private long accessTtlSeconds = 900;
    private long refreshTtlSeconds = 1_209_600;

    public String getSecret() { return secret; }
    public void setSecret(String secret) { this.secret = secret; }

    public long getAccessTtlSeconds() { return accessTtlSeconds; }
    public void setAccessTtlSeconds(long accessTtlSeconds) { this.accessTtlSeconds = accessTtlSeconds; }

    public long getRefreshTtlSeconds() { return refreshTtlSeconds; }
    public void setRefreshTtlSeconds(long refreshTtlSeconds) { this.refreshTtlSeconds = refreshTtlSeconds; }
}
