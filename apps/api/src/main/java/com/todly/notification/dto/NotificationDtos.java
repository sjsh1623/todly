package com.todly.notification.dto;

import jakarta.validation.constraints.NotBlank;

import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

/**
 * DTO records for notifications + settings + push subscription (PHASE 7, SCR-14).
 */
public final class NotificationDtos {

    private NotificationDtos() {}

    public record NotificationItemDto(
            UUID id,
            String type,
            String title,
            String body,
            String link,
            boolean isRead,
            OffsetDateTime createdAt) {}

    public record NotificationPageDto(
            List<NotificationItemDto> items,
            String nextCursor,
            long unreadCount) {}

    public record SettingsDto(
            boolean pushDue,
            boolean pushAssigned,
            boolean pushLive,
            boolean pushComment,
            LocalTime quietFrom,
            LocalTime quietTo) {}

    public record UpdateSettingsRequest(
            Boolean pushDue,
            Boolean pushAssigned,
            Boolean pushLive,
            Boolean pushComment,
            LocalTime quietFrom,
            LocalTime quietTo) {}

    public record PushSubscriptionRequest(
            @NotBlank String token,
            String platform) {}
}
