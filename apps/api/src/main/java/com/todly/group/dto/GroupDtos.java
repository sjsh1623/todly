package com.todly.group.dto;

import com.todly.group.GroupType;
import com.todly.group.MemberRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Request/response payloads for the group, member and invitation API (PHASE 3).
 */
public final class GroupDtos {

    private GroupDtos() {}

    // --- requests ---------------------------------------------------------

    public record CreateGroupRequest(
            @NotBlank @Size(min = 1, max = 60) String name,
            @NotNull GroupType type,
            @NotBlank @Size(max = 20) String color,
            @Size(max = 40) String icon,
            String description) {}

    public record UpdateGroupRequest(
            @Size(min = 1, max = 60) String name,
            @Size(max = 20) String color,
            @Size(max = 40) String icon,
            String description) {}

    public record CreateInvitationRequest(
            @Positive Integer expiresInHours) {}

    public record UpdateMemberRoleRequest(
            @NotNull MemberRole role) {}

    // --- responses --------------------------------------------------------

    public record ProgressDto(int percent, long done, long total) {}

    /** Brief member shape used in the group list (no presence). */
    public record MemberBriefDto(
            UUID userId,
            String username,
            String nickname,
            String profileColor,
            MemberRole role) {}

    /** Full member shape used in the group detail (with presence). */
    public record MemberDto(
            UUID userId,
            String username,
            String nickname,
            String profileColor,
            MemberRole role,
            boolean online,
            OffsetDateTime lastSeenAt) {}

    public record GroupSummaryDto(
            UUID id,
            String name,
            GroupType type,
            String color,
            String icon,
            long memberCount,
            MemberRole role,
            ProgressDto progress,
            List<MemberBriefDto> members) {}

    public record GroupDetailDto(
            UUID id,
            String name,
            GroupType type,
            String color,
            String icon,
            String description,
            UUID ownerId,
            MemberRole role,
            long memberCount,
            long onlineCount,
            ProgressDto progress,
            List<MemberDto> members) {}

    public record InvitationCreatedDto(
            String code,
            String url,
            OffsetDateTime expiresAt) {}

    public record InviteGroupDto(
            UUID id,
            String name,
            String color,
            GroupType type,
            long memberCount) {}

    public record InvitationPreviewDto(
            InviteGroupDto group,
            String status,
            boolean expired) {}

    public record AcceptInvitationDto(UUID groupId) {}
}
