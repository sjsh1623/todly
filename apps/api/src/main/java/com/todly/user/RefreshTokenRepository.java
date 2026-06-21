package com.todly.user;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {
    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Revoke every still-active refresh token for a user (force re-login). */
    @Modifying
    @Query("""
            update RefreshToken rt set rt.revokedAt = :now
            where rt.userId = :userId and rt.revokedAt is null
            """)
    int revokeAllForUser(@Param("userId") UUID userId, @Param("now") OffsetDateTime now);
}
