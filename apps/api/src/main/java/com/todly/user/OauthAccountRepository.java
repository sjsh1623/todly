package com.todly.user;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface OauthAccountRepository extends JpaRepository<OauthAccount, UUID> {
    Optional<OauthAccount> findByProviderAndProviderUid(OauthProvider provider, String providerUid);

    List<OauthAccount> findByUserId(UUID userId);

    void deleteByUserId(UUID userId);
}
