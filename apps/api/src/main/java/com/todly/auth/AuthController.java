package com.todly.auth;

import com.todly.auth.dto.AuthDtos.AuthResponse;
import com.todly.auth.dto.AuthDtos.LoginRequest;
import com.todly.auth.dto.AuthDtos.LogoutRequest;
import com.todly.auth.dto.AuthDtos.OauthRequest;
import com.todly.auth.dto.AuthDtos.PasswordResetRequest;
import com.todly.auth.dto.AuthDtos.PasswordResetRequestRequest;
import com.todly.auth.dto.AuthDtos.RefreshRequest;
import com.todly.auth.dto.AuthDtos.SignupRequest;
import com.todly.auth.dto.AuthDtos.TokenResponse;
import com.todly.auth.dto.AuthDtos.UsernameAvailabilityResponse;
import com.todly.common.ApiException;
import com.todly.user.OauthProvider;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public AuthResponse signup(@Valid @RequestBody SignupRequest req) {
        return authService.signup(req);
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshRequest req) {
        return authService.refresh(req);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@Valid @RequestBody LogoutRequest req) {
        authService.logout(req.refreshToken());
    }

    @PostMapping("/oauth/{provider}")
    public AuthResponse oauth(@PathVariable String provider,
                              @Valid @RequestBody OauthRequest req) {
        return authService.oauthLogin(parseProvider(provider), req);
    }

    @PostMapping("/password/reset-request")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void requestPasswordReset(@Valid @RequestBody PasswordResetRequestRequest req) {
        authService.requestPasswordReset(req);
    }

    @PostMapping("/password/reset")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void resetPassword(@Valid @RequestBody PasswordResetRequest req) {
        authService.resetPassword(req);
    }

    @GetMapping("/check-username")
    public UsernameAvailabilityResponse checkUsername(@RequestParam String username) {
        return new UsernameAvailabilityResponse(authService.isUsernameAvailable(username));
    }

    private OauthProvider parseProvider(String provider) {
        try {
            return OauthProvider.valueOf(provider.toLowerCase());
        } catch (IllegalArgumentException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "UNSUPPORTED_PROVIDER",
                "Unsupported OAuth provider: " + provider);
        }
    }
}
