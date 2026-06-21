package com.todly.account;

import com.todly.user.OauthProvider;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;

/**
 * Request/response DTOs for PHASE 10 (Profile/Settings, Account, Help).
 *
 * <p>{@code profileColor} and {@code theme} are accepted as plain strings and
 * validated against the enum value sets in {@link AccountService}, so an invalid
 * value yields a 400 VALIDATION_ERROR rather than a Jackson deserialization 500.
 */
public final class AccountDtos {

    private AccountDtos() {}

    /** PATCH /me — every field optional; only non-null fields are applied. */
    public record UpdateMeRequest(
        @Size(min = 1, max = 20, message = "nickname must be 1-20 chars")
        String nickname,

        @Pattern(regexp = "blue|green|orange|purple",
            message = "profileColor must be one of blue|green|orange|purple")
        String profileColor,

        @Pattern(regexp = "ocean|mint|violet|coral|sunset",
            message = "theme must be one of ocean|mint|violet|coral|sunset")
        String theme,

        Boolean darkMode,

        @Pattern(regexp = "^[a-zA-Z]{2}(-[a-zA-Z]{2,4})?$",
            message = "language must be a short code, e.g. ko, en, en-US")
        String language,

        @Size(max = 512, message = "avatarUrl must be at most 512 chars")
        String avatarUrl
    ) {}

    public record ChangePasswordRequest(
        @NotBlank(message = "currentPassword is required")
        String currentPassword,

        @NotBlank @Size(min = 8, message = "newPassword must be at least 8 chars")
        String newPassword
    ) {}

    /** DELETE /me — password required only for accounts that have a password set. */
    public record DeleteMeRequest(
        String password
    ) {}

    public record ConnectedAccountDto(OauthProvider provider, OffsetDateTime linkedAt) {}
}
