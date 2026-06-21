package com.todly.realtime;

import com.todly.task.dto.TaskDtos.ProgressDto;
import com.todly.task.dto.TaskDtos.TaskDto;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Payload records for the realtime event envelopes broadcast over STOMP.
 *
 * <p>Each {@code RealtimeEvent.payload} is one of these records; the JSON shape
 * is dictated by the {@link RealtimeEvent#type()}:
 * <ul>
 *   <li>{@code task.*} → {@link TaskEventPayload}</li>
 *   <li>{@code live.started} / {@code live.paused} → {@link LiveSessionPayload}</li>
 *   <li>{@code live.ended} → {@link LiveEndedPayload}</li>
 *   <li>{@code presence.updated} → {@link PresencePayload}</li>
 * </ul>
 */
public final class RealtimePayloads {

    private RealtimePayloads() {}

    /** Payload for {@code task.created|updated|completed|reopened|deleted}. */
    public record TaskEventPayload(TaskDto task, ProgressDto progress) {}

    /** A live session as broadcast to clients. */
    public record LiveSessionDto(
            UUID id,
            UUID taskId,
            String taskTitle,
            UUID userId,
            String nickname,
            String profileColor,
            OffsetDateTime startedAt,
            String status) {}

    /** Payload for {@code live.started} and {@code live.paused}. */
    public record LiveSessionPayload(LiveSessionDto session) {}

    /** Payload for {@code live.ended}. */
    public record LiveEndedPayload(UUID sessionId, UUID taskId, UUID userId) {}

    /** Payload for {@code presence.updated}. */
    public record PresencePayload(UUID groupId, int onlineCount, List<UUID> online) {}
}
