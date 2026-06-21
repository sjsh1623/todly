package com.todly.account;

import com.todly.account.AccountDtos.ChangePasswordRequest;
import com.todly.account.AccountDtos.ConnectedAccountDto;
import com.todly.account.AccountDtos.DeleteMeRequest;
import com.todly.account.AccountDtos.UpdateMeRequest;
import com.todly.auth.dto.AuthDtos.UserDto;
import com.todly.comment.Comment;
import com.todly.comment.CommentRepository;
import com.todly.common.ApiException;
import com.todly.gamification.UserStats;
import com.todly.gamification.UserStatsRepository;
import com.todly.group.GroupMember;
import com.todly.group.GroupMemberRepository;
import com.todly.notification.DeviceTokenRepository;
import com.todly.routine.Routine;
import com.todly.routine.RoutineRepository;
import com.todly.task.Task;
import com.todly.task.TaskRepository;
import com.todly.user.AppTheme;
import com.todly.user.OauthAccount;
import com.todly.user.OauthAccountRepository;
import com.todly.user.ProfileColor;
import com.todly.user.RefreshTokenRepository;
import com.todly.user.User;
import com.todly.user.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * PHASE 10 account/settings service: profile + preference updates, password
 * change, connected-account listing, data export and account withdrawal
 * (PII anonymization per 기술설계 §7).
 */
@Service
public class AccountService {

    private static final String DELETED_NICKNAME = "탈퇴한 사용자";

    private final UserRepository userRepository;
    private final OauthAccountRepository oauthAccountRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final DeviceTokenRepository deviceTokenRepository;
    private final GroupMemberRepository groupMemberRepository;
    private final TaskRepository taskRepository;
    private final CommentRepository commentRepository;
    private final RoutineRepository routineRepository;
    private final UserStatsRepository userStatsRepository;
    private final PasswordEncoder passwordEncoder;

    public AccountService(UserRepository userRepository,
                          OauthAccountRepository oauthAccountRepository,
                          RefreshTokenRepository refreshTokenRepository,
                          DeviceTokenRepository deviceTokenRepository,
                          GroupMemberRepository groupMemberRepository,
                          TaskRepository taskRepository,
                          CommentRepository commentRepository,
                          RoutineRepository routineRepository,
                          UserStatsRepository userStatsRepository,
                          PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.oauthAccountRepository = oauthAccountRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.deviceTokenRepository = deviceTokenRepository;
        this.groupMemberRepository = groupMemberRepository;
        this.taskRepository = taskRepository;
        this.commentRepository = commentRepository;
        this.routineRepository = routineRepository;
        this.userStatsRepository = userStatsRepository;
        this.passwordEncoder = passwordEncoder;
    }

    // --- profile + preferences (PATCH /me) --------------------------------

    @Transactional
    public UserDto updateMe(UUID userId, UpdateMeRequest req) {
        User user = activeUser(userId);
        if (req.nickname() != null) {
            user.setNickname(req.nickname());
        }
        if (req.profileColor() != null) {
            user.setProfileColor(ProfileColor.valueOf(req.profileColor()));
        }
        if (req.theme() != null) {
            user.setTheme(AppTheme.valueOf(req.theme()));
        }
        if (req.darkMode() != null) {
            user.setDarkMode(req.darkMode());
        }
        if (req.language() != null) {
            user.setLanguage(req.language());
        }
        if (req.avatarUrl() != null) {
            user.setAvatarUrl(req.avatarUrl().isBlank() ? null : req.avatarUrl());
        }
        return UserDto.from(user);
    }

    // --- password change (POST /me/password) ------------------------------

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        User user = activeUser(userId);
        if (user.getPasswordHash() == null) {
            throw ApiException.badRequest("NO_PASSWORD_SET",
                "This is a social-only account; set a password via password reset first");
        }
        if (!passwordEncoder.matches(req.currentPassword(), user.getPasswordHash())) {
            throw ApiException.invalidCredentials();
        }
        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        // Revoke ALL refresh tokens: every device must re-login. The caller's
        // current access token keeps working until it expires; refresh then fails.
        refreshTokenRepository.revokeAllForUser(userId, OffsetDateTime.now());
    }

    // --- connected accounts (GET /me/connected-accounts) ------------------

    @Transactional(readOnly = true)
    public List<ConnectedAccountDto> connectedAccounts(UUID userId) {
        return oauthAccountRepository.findByUserId(userId).stream()
            .sorted(Comparator.comparing(OauthAccount::getCreatedAt))
            .map(a -> new ConnectedAccountDto(a.getProvider(), a.getCreatedAt()))
            .toList();
    }

    // --- data export (GET /me/export) -------------------------------------

    @Transactional(readOnly = true)
    public Map<String, Object> exportData(UUID userId) {
        User user = activeUser(userId);

        Map<String, Object> root = new LinkedHashMap<>();
        root.put("exportedAt", OffsetDateTime.now().toString());
        root.put("profile", profileMap(user));

        // Group memberships (active groups only).
        List<Map<String, Object>> groups = groupMemberRepository.findMyMemberships(userId).stream()
            .map(this::membershipMap)
            .toList();
        root.put("groups", groups);

        // Tasks the user created (across active groups they belong to).
        List<UUID> groupIds = groupMemberRepository.findActiveGroupIds(userId);
        List<Map<String, Object>> tasks = groupIds.stream()
            .flatMap(gid -> taskRepository.findGroupTasks(gid).stream())
            .filter(t -> userId.equals(t.getCreatorId()))
            .map(this::taskMap)
            .toList();
        root.put("createdTasks", tasks);

        // Comments authored by the user (read straight from repository).
        // We only expose the caller's own comment rows.
        List<Map<String, Object>> comments = tasks.stream()
            .map(t -> (UUID) t.get("id"))
            .flatMap(taskId -> commentRepository.findActiveByTask(taskId).stream())
            .filter(c -> userId.equals(c.getAuthorId()))
            .map(this::commentMap)
            .toList();
        root.put("comments", comments);

        // Routines created by the user.
        List<Map<String, Object>> routines = routineRepository.findMine(userId).stream()
            .filter(r -> userId.equals(r.getCreatorId()))
            .map(this::routineMap)
            .toList();
        root.put("routines", routines);

        // Gamification stats.
        root.put("stats", userStatsRepository.findById(userId)
            .map(this::statsMap)
            .orElse(Map.of()));

        return root;
    }

    // --- account withdrawal (DELETE /me) ----------------------------------

    @Transactional
    public void deleteMe(UUID userId, DeleteMeRequest req) {
        User user = activeUser(userId);

        if (user.getPasswordHash() != null) {
            // Password account: require + verify the password before withdrawal.
            if (req == null || req.password() == null || req.password().isBlank()
                || !passwordEncoder.matches(req.password(), user.getPasswordHash())) {
                throw ApiException.invalidCredentials();
            }
        }
        // Social-only accounts (no passwordHash) may withdraw without a password.

        OffsetDateTime now = OffsetDateTime.now();
        String marker = user.getId().toString();

        // Anonymize PII (기술설계 §7). email + username carry global UNIQUE
        // constraints, so both are scrambled to collision-free values.
        user.setDeletedAt(now);
        user.setEmail("deleted-" + marker + "@deleted.todly");
        // username column is 30 chars; "deleted_" (8) + 16 hex = 24 chars, unique.
        user.setUsername("deleted_" + marker.replace("-", "").substring(0, 16));
        user.setNickname(DELETED_NICKNAME);
        user.setPasswordHash(null);
        user.setAvatarUrl(null);

        // Remove auth surface: oauth links, device tokens, refresh tokens.
        oauthAccountRepository.deleteByUserId(userId);
        deviceTokenRepository.deleteByUserId(userId);
        refreshTokenRepository.revokeAllForUser(userId, now);
    }

    // --- helpers ----------------------------------------------------------

    private User activeUser(UUID userId) {
        return userRepository.findByIdAndDeletedAtIsNull(userId)
            .orElseThrow(() -> ApiException.notFound("User not found"));
    }

    private Map<String, Object> profileMap(User u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("nickname", u.getNickname());
        m.put("email", u.getEmail());
        m.put("profileColor", u.getProfileColor());
        m.put("avatarUrl", u.getAvatarUrl());
        m.put("theme", u.getTheme());
        m.put("darkMode", u.isDarkMode());
        m.put("language", u.getLanguage());
        m.put("timezone", u.getTimezone());
        m.put("createdAt", u.getCreatedAt());
        return m;
    }

    private Map<String, Object> membershipMap(GroupMember gm) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("groupId", gm.getGroup().getId());
        m.put("groupName", gm.getGroup().getName());
        m.put("role", gm.getRole());
        m.put("joinedAt", gm.getJoinedAt());
        return m;
    }

    private Map<String, Object> taskMap(Task t) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", t.getId());
        m.put("groupId", t.getGroup() != null ? t.getGroup().getId() : null);
        m.put("title", t.getTitle());
        m.put("note", t.getNote());
        m.put("status", t.getStatus());
        m.put("priority", t.getPriority());
        m.put("dueDate", t.getDueDate());
        m.put("createdAt", t.getCreatedAt());
        return m;
    }

    private Map<String, Object> commentMap(Comment c) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", c.getId());
        m.put("taskId", c.getTaskId());
        m.put("body", c.getBody());
        m.put("createdAt", c.getCreatedAt());
        return m;
    }

    private Map<String, Object> routineMap(Routine r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", r.getId());
        m.put("title", r.getTitle());
        m.put("recurFreq", r.getRecurFreq());
        m.put("isActive", r.isActive());
        m.put("createdAt", r.getCreatedAt());
        return m;
    }

    private Map<String, Object> statsMap(UserStats s) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("lifeScore", s.getLifeScore());
        m.put("routineScore", s.getRoutineScore());
        m.put("completionRate", s.getCompletionRate());
        m.put("currentStreak", s.getCurrentStreak());
        m.put("bestStreak", s.getBestStreak());
        m.put("yearlyCount", s.getYearlyCount());
        return m;
    }
}
