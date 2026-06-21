package com.todly.auth.dto;

import com.todly.user.AppTheme;
import com.todly.user.ProfileColor;
import com.todly.user.User;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.UUID;

/**
 * Request/response DTOs for the auth API. Grouped in one file as they are small
 * records that share the same contract.
 */
public final class AuthDtos {

    private AuthDtos() {}

    public record SignupRequest(
        @NotBlank
        @Pattern(regexp = "^[a-z0-9_]{3,30}$",
            message = "username must be 3-30 chars of [a-z0-9_]")
        String username,

        @NotBlank @Size(min = 1, max = 20, message = "nickname must be 1-20 chars")
        String nickname,

        @NotBlank @Email(message = "email must be a valid email address")
        String email,

        @NotBlank @Size(min = 8, message = "password must be at least 8 chars")
        String password,

        @NotNull(message = "profileColor is required")
        ProfileColor profileColor
    ) {}

    public record LoginRequest(
        @NotBlank @Email String email,
        @NotBlank String password
    ) {}

    public record RefreshRequest(@NotBlank String refreshToken) {}

    public record LogoutRequest(@NotBlank String refreshToken) {}

    public record OauthRequest(@NotBlank String idToken) {}

    public record PasswordResetRequestRequest(@NotBlank @Email String email) {}

    public record PasswordResetRequest(
        @NotBlank String token,
        @NotBlank @Size(min = 8, message = "newPassword must be at least 8 chars") String newPassword
    ) {}

    public record UserDto(
        UUID id,
        String username,
        String nickname,
        String email,
        ProfileColor profileColor,
        AppTheme theme,
        boolean darkMode,
        String language,
        String avatarUrl
    ) {
        public static UserDto from(User u) {
            return new UserDto(u.getId(), u.getUsername(), u.getNickname(), u.getEmail(),
                u.getProfileColor(), u.getTheme(), u.isDarkMode(),
                u.getLanguage(), u.getAvatarUrl());
        }
    }

    public record AuthResponse(String accessToken, String refreshToken, UserDto user) {}

    public record TokenResponse(String accessToken, String refreshToken) {}

    public record UsernameAvailabilityResponse(boolean available) {}
}
