package com.todly.live.dto;

import com.todly.live.LiveStatus;

import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Request/response payloads for the live-session REST API (PHASE 5).
 */
public final class LiveDtos {

    private LiveDtos() {}

    public record PauseRequest(boolean paused) {}

    public record SessionDto(
            UUID id,
            UUID taskId,
            String taskTitle,
            UUID userId,
            String nickname,
            String profileColor,
            OffsetDateTime startedAt,
            int pausedSeconds,
            LiveStatus status,
            OffsetDateTime endedAt) {}

    public record SessionResponse(SessionDto session) {}
}
