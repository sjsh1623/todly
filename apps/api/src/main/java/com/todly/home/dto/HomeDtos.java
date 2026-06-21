package com.todly.home.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Response payloads for the home summary API (PHASE 4).
 */
public final class HomeDtos {

    private HomeDtos() {}

    public record GreetingDto(
            String phrase,
            String name,
            LocalDate date) {}

    public record NeedsAttentionDto(
            UUID taskId,
            String title,
            UUID groupId,
            String groupName,
            LocalDate dueDate,
            String level,
            Long daysOverdue) {}

    public record MemberBriefDto(
            UUID userId,
            String nickname,
            String profileColor) {}

    public record ProgressDto(int percent, long done, long total) {}

    /** A member currently in a live session, shown in the "지금 활동 중" strip. */
    public record LiveNowDto(
            UUID userId,
            String nickname,
            String profileColor,
            UUID taskId,
            String taskTitle,
            OffsetDateTime startedAt,
            String status) {}

    public record GroupProgressDto(
            UUID groupId,
            String name,
            String color,
            ProgressDto progress,
            List<MemberBriefDto> members) {}

    public record HomeSummaryDto(
            GreetingDto greeting,
            List<LiveNowDto> liveNow,
            List<NeedsAttentionDto> needsAttention,
            List<GroupProgressDto> groupProgress) {}
}
