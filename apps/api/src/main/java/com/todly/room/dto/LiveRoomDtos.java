package com.todly.room.dto;

import jakarta.validation.constraints.NotNull;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * Request/response DTOs and realtime payloads for live rooms (PHASE 6).
 */
public final class LiveRoomDtos {

    private LiveRoomDtos() {}

    // --- requests ---------------------------------------------------------

    public record CreateRoomRequest(@NotNull UUID taskId) {}

    public record MessageRequest(String body, String emoji) {}

    // --- nested DTOs ------------------------------------------------------

    public record UserRef(UUID userId, String nickname, String profileColor) {}

    public record ParticipantDto(UUID userId, String nickname, String profileColor,
                                 boolean isHost, OffsetDateTime joinedAt) {}

    public record MessageDto(UUID id, UUID roomId, UUID senderId, String nickname,
                             String profileColor, String body, String emoji,
                             OffsetDateTime createdAt) {}

    public record PhotoDto(UUID id, UUID roomId, UUID uploaderId, String nickname,
                           String url, String thumbUrl, OffsetDateTime createdAt) {}

    // --- responses --------------------------------------------------------

    /** POST create/join responses: a compact room summary. */
    public record RoomDto(UUID id, String title, String status,
                          OffsetDateTime startedAt, OffsetDateTime endedAt,
                          UserRef host, int participantCount) {}

    public record RoomResponse(RoomDto room) {}

    /** GET /live-rooms/{id} full detail. */
    public record RoomDetailDto(UUID id, String title, String status,
                                OffsetDateTime startedAt, OffsetDateTime endedAt,
                                UserRef host, int participantCount,
                                List<ParticipantDto> participants,
                                List<MessageDto> messages,
                                List<PhotoDto> photos) {}

    /** GET /live-rooms?scope=mine list entry. */
    public record RoomListItem(UUID id, String title, UUID taskId, UUID groupId,
                               UserRef host, int participantCount,
                               OffsetDateTime startedAt) {}

    // --- realtime payloads ------------------------------------------------

    /** {@code room.started} broadcast to the task's group topic. */
    public record RoomStartedPayload(UUID roomId, UUID taskId, UUID groupId,
                                     String title, UserRef host) {}

    /** {@code room.participants} (and join/left) broadcast to the room topic. */
    public record ParticipantsPayload(UUID roomId, int participantCount,
                                      List<ParticipantDto> participants) {}

    /** {@code room.joined} / {@code room.left}. */
    public record MembershipPayload(UUID roomId, UserRef user, int participantCount) {}

    /** {@code room.ended}. */
    public record RoomEndedPayload(UUID roomId, UUID taskId, OffsetDateTime endedAt) {}
}
