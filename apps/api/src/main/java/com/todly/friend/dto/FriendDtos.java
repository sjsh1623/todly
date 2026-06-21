package com.todly.friend.dto;

import jakarta.validation.constraints.NotEmpty;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Request/response payloads for the friend + user-search API (PHASE 8).
 */
public final class FriendDtos {

    private FriendDtos() {}

    // --- requests ---------------------------------------------------------

    /** Send a friend request by @username or by userId (one of the two). */
    public record SendRequestBody(String username, UUID userId) {}

    /** Direct-add friends to a group. */
    public record InviteFriendsBody(@NotEmpty List<UUID> userIds) {}

    // --- responses --------------------------------------------------------

    /** Compact user shape embedded in friend payloads. */
    public record UserBrief(
            UUID userId,
            String username,
            String nickname,
            String profileColor) {}

    /** A user-search hit, from the caller's perspective. */
    public record SearchResultDto(
            UUID userId,
            String username,
            String nickname,
            String profileColor,
            String relation,
            long sharedGroups) {}

    /** An accepted friend with presence + shared-group count. */
    public record FriendDto(
            UUID userId,
            String username,
            String nickname,
            String profileColor,
            boolean online,
            OffsetDateTime lastActiveAt,
            long sharedGroups) {}

    public record IncomingRequestDto(UUID id, UserBrief fromUser, OffsetDateTime createdAt) {}

    public record OutgoingRequestDto(UUID id, UserBrief toUser, OffsetDateTime createdAt) {}

    public record RequestsDto(List<IncomingRequestDto> incoming, List<OutgoingRequestDto> outgoing) {}

    /** Result of sending a request: either a created pending request or an auto-accept. */
    public record SendResultDto(String status, RequestBriefDto request) {}

    public record RequestBriefDto(UUID id, UserBrief toUser, String status, OffsetDateTime createdAt) {}

    /** Result of inviting friends to a group. */
    public record InviteFriendsResultDto(List<UUID> added, List<UUID> skipped) {}
}
