package com.todly.user;

import com.todly.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.OffsetDateTime;

@Entity
@Table(name = "users")
public class User extends BaseEntity {

    @Column(name = "email", nullable = false, unique = true)
    private String email;

    @Column(name = "username", nullable = false, unique = true, length = 30)
    private String username;

    @Column(name = "password_hash")
    private String passwordHash;

    @Column(name = "nickname", nullable = false, length = 20)
    private String nickname;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    @Column(name = "profile_color", nullable = false, columnDefinition = "profile_color")
    private ProfileColor profileColor = ProfileColor.blue;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @JdbcTypeCode(SqlTypes.NAMED_ENUM)
    @Enumerated(EnumType.STRING)
    @Column(name = "theme", nullable = false, columnDefinition = "app_theme")
    private AppTheme theme = AppTheme.ocean;

    @Column(name = "dark_mode", nullable = false)
    private boolean darkMode = false;

    @Column(name = "language", nullable = false, length = 8)
    private String language = "ko";

    @Column(name = "timezone", nullable = false, length = 64)
    private String timezone = "Asia/Seoul";

    @Column(name = "last_active_at")
    private OffsetDateTime lastActiveAt;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPasswordHash() { return passwordHash; }
    public void setPasswordHash(String passwordHash) { this.passwordHash = passwordHash; }

    public String getNickname() { return nickname; }
    public void setNickname(String nickname) { this.nickname = nickname; }

    public ProfileColor getProfileColor() { return profileColor; }
    public void setProfileColor(ProfileColor profileColor) { this.profileColor = profileColor; }

    public String getAvatarUrl() { return avatarUrl; }
    public void setAvatarUrl(String avatarUrl) { this.avatarUrl = avatarUrl; }

    public AppTheme getTheme() { return theme; }
    public void setTheme(AppTheme theme) { this.theme = theme; }

    public boolean isDarkMode() { return darkMode; }
    public void setDarkMode(boolean darkMode) { this.darkMode = darkMode; }

    public String getLanguage() { return language; }
    public void setLanguage(String language) { this.language = language; }

    public String getTimezone() { return timezone; }
    public void setTimezone(String timezone) { this.timezone = timezone; }

    public OffsetDateTime getLastActiveAt() { return lastActiveAt; }
    public void setLastActiveAt(OffsetDateTime lastActiveAt) { this.lastActiveAt = lastActiveAt; }

    public OffsetDateTime getDeletedAt() { return deletedAt; }
    public void setDeletedAt(OffsetDateTime deletedAt) { this.deletedAt = deletedAt; }
}
