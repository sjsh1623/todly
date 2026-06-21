package com.todly.auth;

import com.todly.auth.dto.AuthDtos.AuthResponse;
import com.todly.auth.dto.AuthDtos.LoginRequest;
import com.todly.auth.dto.AuthDtos.OauthRequest;
import com.todly.auth.dto.AuthDtos.PasswordResetRequest;
import com.todly.auth.dto.AuthDtos.PasswordResetRequestRequest;
import com.todly.auth.dto.AuthDtos.RefreshRequest;
import com.todly.auth.dto.AuthDtos.SignupRequest;
import com.todly.auth.dto.AuthDtos.TokenResponse;
import com.todly.auth.dto.AuthDtos.UserDto;
import com.todly.auth.oidc.OidcUserInfo;
import com.todly.auth.oidc.OidcVerifierRegistry;
import com.todly.common.ApiException;
import com.todly.gamification.UserStats;
import com.todly.gamification.UserStatsRepository;
import com.todly.notification.NotificationSettings;
import com.todly.notification.NotificationSettingsRepository;
import com.todly.user.AppTheme;
import com.todly.user.OauthAccount;
import com.todly.user.OauthAccountRepository;
import com.todly.user.OauthProvider;
import com.todly.user.PasswordResetToken;
import com.todly.user.PasswordResetTokenRepository;
import com.todly.user.RefreshToken;
import com.todly.user.User;
import com.todly.user.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;

/**
 * Orchestrates all authentication flows: signup, login, refresh-token rotation,
 * logout, social (OIDC) login with find-or-create, and password reset.
 */
@Service
public class AuthService {

    private static final Logger log = LoggerFactory.getLogger(AuthService.class);
    private static final long RESET_TOKEN_TTL_SECONDS = 3600; // 1 hour

    private final UserRepository userRepository;
    private final OauthAccountRepository oauthAccountRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final NotificationSettingsRepository notificationSettingsRepository;
    private final UserStatsRepository userStatsRepository;
    private final PasswordEncoder passwordEncoder;
    private final TokenService tokenService;
    private final OidcVerifierRegistry oidcRegistry;
    private final SecureRandom random = new SecureRandom();

    public AuthService(UserRepository userRepository,
                       OauthAccountRepository oauthAccountRepository,
                       PasswordResetTokenRepository passwordResetTokenRepository,
                       NotificationSettingsRepository notificationSettingsRepository,
                       UserStatsRepository userStatsRepository,
                       PasswordEncoder passwordEncoder,
                       TokenService tokenService,
                       OidcVerifierRegistry oidcRegistry) {
        this.userRepository = userRepository;
        this.oauthAccountRepository = oauthAccountRepository;
        this.passwordResetTokenRepository = passwordResetTokenRepository;
        this.notificationSettingsRepository = notificationSettingsRepository;
        this.userStatsRepository = userStatsRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenService = tokenService;
        this.oidcRegistry = oidcRegistry;
    }

    @Transactional
    public AuthResponse signup(SignupRequest req) {
        if (userRepository.existsByEmail(req.email())) {
            throw ApiException.emailTaken();
        }
        if (userRepository.existsByUsername(req.username())) {
            throw ApiException.usernameTaken();
        }

        User user = new User();
        user.setEmail(req.email());
        user.setUsername(req.username());
        user.setNickname(req.nickname());
        user.setProfileColor(req.profileColor());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setTheme(AppTheme.ocean);
        user.setDarkMode(false);
        user = userRepository.save(user);

        createDefaultUserRows(user.getId());

        return toAuthResponse(user);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        User user = userRepository.findByEmailAndDeletedAtIsNull(req.email())
            .orElseThrow(ApiException::invalidCredentials);
        if (user.getPasswordHash() == null
            || !passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw ApiException.invalidCredentials();
        }
        return toAuthResponse(user);
    }

    /** Refresh-token rotation: revoke the presented token and issue a new pair. */
    @Transactional
    public TokenResponse refresh(RefreshRequest req) {
        RefreshToken stored = tokenService.validateRefreshToken(req.refreshToken());
        User user = userRepository.findById(stored.getUserId())
            .orElseThrow(() -> ApiException.invalidToken("User no longer exists"));
        tokenService.revoke(req.refreshToken());
        TokenService.TokenPair pair = tokenService.issuePair(user);
        return new TokenResponse(pair.accessToken(), pair.refreshToken());
    }

    @Transactional
    public void logout(String rawRefresh) {
        tokenService.revoke(rawRefresh);
    }

    @Transactional
    public AuthResponse oauthLogin(OauthProvider provider, OauthRequest req) {
        OidcUserInfo info = oidcRegistry.get(provider).verify(req.idToken());

        // 1) Already linked by provider + subject?
        User user = oauthAccountRepository
            .findByProviderAndProviderUid(provider, info.subject())
            .map(acc -> userRepository.findById(acc.getUserId())
                .orElseThrow(() -> ApiException.invalidToken("Linked user missing")))
            .orElse(null);

        if (user == null) {
            // 2) Link by verified email to an existing local account, else create.
            if (info.email() == null || info.email().isBlank()) {
                throw ApiException.invalidToken("Provider did not supply an email");
            }
            user = userRepository.findByEmail(info.email()).orElse(null);
            if (user == null) {
                user = createUserFromOidc(provider, info);
            }
            linkOauthAccount(user.getId(), provider, info.subject());
        }

        return toAuthResponse(user);
    }

    /** Always returns 204 to the caller; never reveals whether the email exists. */
    @Transactional
    public void requestPasswordReset(PasswordResetRequestRequest req) {
        userRepository.findByEmail(req.email()).ifPresent(user -> {
            String rawToken = generateResetToken();
            PasswordResetToken entity = new PasswordResetToken();
            entity.setUserId(user.getId());
            entity.setTokenHash(TokenService.sha256(rawToken));
            entity.setExpiresAt(OffsetDateTime.now().plusSeconds(RESET_TOKEN_TTL_SECONDS));
            passwordResetTokenRepository.save(entity);
            // TODO(email): send the raw reset token to the user via email.
            // Email delivery is out of scope for PHASE 2; the token is logged so
            // the reset flow is exercisable end-to-end.
            log.info("Password reset token issued for user {} (raw token: {})",
                user.getId(), rawToken);
        });
    }

    @Transactional
    public void resetPassword(PasswordResetRequest req) {
        PasswordResetToken stored = passwordResetTokenRepository
            .findByTokenHash(TokenService.sha256(req.token()))
            .orElseThrow(() -> ApiException.invalidToken("Invalid reset token"));
        if (stored.getUsedAt() != null) {
            throw ApiException.invalidToken("Reset token already used");
        }
        if (stored.getExpiresAt().isBefore(OffsetDateTime.now())) {
            throw ApiException.invalidToken("Reset token has expired");
        }
        User user = userRepository.findById(stored.getUserId())
            .orElseThrow(() -> ApiException.invalidToken("User no longer exists"));
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
        stored.setUsedAt(OffsetDateTime.now());
        passwordResetTokenRepository.save(stored);
    }

    @Transactional(readOnly = true)
    public boolean isUsernameAvailable(String username) {
        return !userRepository.existsByUsername(username);
    }

    @Transactional(readOnly = true)
    public UserDto currentUser(UUID userId) {
        User user = userRepository.findByIdAndDeletedAtIsNull(userId)
            .orElseThrow(() -> ApiException.notFound("User not found"));
        return UserDto.from(user);
    }

    // --- helpers ----------------------------------------------------------

    private AuthResponse toAuthResponse(User user) {
        TokenService.TokenPair pair = tokenService.issuePair(user);
        return new AuthResponse(pair.accessToken(), pair.refreshToken(), UserDto.from(user));
    }

    private User createUserFromOidc(OauthProvider provider, OidcUserInfo info) {
        User user = new User();
        user.setEmail(info.email());
        user.setUsername(generateUniqueUsername(info));
        user.setNickname(deriveNickname(info));
        user.setProfileColor(com.todly.user.ProfileColor.blue);
        user.setTheme(AppTheme.ocean);
        user.setDarkMode(false);
        user.setPasswordHash(null); // social-only account
        user = userRepository.save(user);
        createDefaultUserRows(user.getId());
        return user;
    }

    private void linkOauthAccount(UUID userId, OauthProvider provider, String subject) {
        OauthAccount acc = new OauthAccount();
        acc.setUserId(userId);
        acc.setProvider(provider);
        acc.setProviderUid(subject);
        oauthAccountRepository.save(acc);
    }

    private void createDefaultUserRows(UUID userId) {
        NotificationSettings settings = new NotificationSettings();
        settings.setUserId(userId);
        notificationSettingsRepository.save(settings);

        UserStats stats = new UserStats();
        stats.setUserId(userId);
        userStatsRepository.save(stats);
    }

    private String deriveNickname(OidcUserInfo info) {
        if (info.name() != null && !info.name().isBlank()) {
            return info.name().length() > 20 ? info.name().substring(0, 20) : info.name();
        }
        String local = info.email().split("@")[0];
        return local.length() > 20 ? local.substring(0, 20) : local;
    }

    private String generateUniqueUsername(OidcUserInfo info) {
        String base = info.email().split("@")[0]
            .toLowerCase()
            .replaceAll("[^a-z0-9_]", "");
        if (base.length() < 3) {
            base = "user" + base;
        }
        if (base.length() > 24) {
            base = base.substring(0, 24);
        }
        String candidate = base;
        while (userRepository.existsByUsername(candidate)) {
            candidate = base + "_" + (1000 + random.nextInt(9000));
        }
        return candidate;
    }

    private String generateResetToken() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
