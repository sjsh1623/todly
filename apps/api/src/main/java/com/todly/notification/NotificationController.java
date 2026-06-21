package com.todly.notification;

import com.todly.common.CurrentUser;
import com.todly.notification.dto.NotificationDtos.NotificationPageDto;
import com.todly.notification.dto.NotificationDtos.PushSubscriptionRequest;
import com.todly.notification.dto.NotificationDtos.SettingsDto;
import com.todly.notification.dto.NotificationDtos.UpdateSettingsRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Notification inbox, read state, settings (SCR-14) and push subscription
 * endpoints (PHASE 7). All require authentication; everything is scoped to the
 * current user.
 */
@RestController
@RequestMapping("/api/v1/me")
public class NotificationController {

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/notifications")
    public NotificationPageDto list(@RequestParam(required = false) String cursor,
                                    @RequestParam(defaultValue = "20") int limit) {
        return notificationService.feed(CurrentUser.id(), cursor, limit);
    }

    @PostMapping("/notifications/{id}/read")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markRead(@PathVariable UUID id) {
        notificationService.markRead(CurrentUser.id(), id);
    }

    @PostMapping("/notifications/read-all")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markAllRead() {
        notificationService.markAllRead(CurrentUser.id());
    }

    @GetMapping("/notification-settings")
    public SettingsDto getSettings() {
        return notificationService.getSettings(CurrentUser.id());
    }

    @PatchMapping("/notification-settings")
    public SettingsDto updateSettings(@RequestBody UpdateSettingsRequest req) {
        return notificationService.updateSettings(CurrentUser.id(), req);
    }

    @PostMapping("/push-subscription")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void pushSubscription(@Valid @RequestBody PushSubscriptionRequest req) {
        notificationService.registerPushSubscription(CurrentUser.id(), req);
    }
}
