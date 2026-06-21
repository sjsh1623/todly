package com.todly.activity.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * DTO records for the activity feed (PHASE 7, SCR-08).
 */
public final class ActivityDtos {

    private ActivityDtos() {}

    /** The actor (who performed the action). */
    public record ActorDto(UUID userId, String nickname, String profileColor) {}

    /**
     * One feed item. {@code groupId}/{@code groupName} are populated only for the
     * merged ("전체") feed; the per-group feed leaves them null.
     */
    public record ActivityItemDto(
            UUID id,
            UUID groupId,
            String groupName,
            String type,
            ActorDto actor,
            UUID targetTaskId,
            String targetTitle,
            JsonNode meta,
            OffsetDateTime createdAt) {}

    /** A cursor-paginated page of activity items. */
    public record ActivityPageDto(List<ActivityItemDto> items, String nextCursor) {}
}
