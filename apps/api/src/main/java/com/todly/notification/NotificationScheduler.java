package com.todly.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

/**
 * Hourly due/overdue notification scanner (PHASE 7, §3.5). Delegates to the
 * TESTABLE {@link NotificationService#scanDue(LocalDate)} so tests can drive it
 * deterministically without waiting on the timer.
 *
 * <p>Single-instance scheduling is assumed; wrap with ShedLock for multi-node.
 */
@Component
public class NotificationScheduler {

    private static final Logger log = LoggerFactory.getLogger(NotificationScheduler.class);

    private final NotificationService notificationService;

    public NotificationScheduler(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @Scheduled(fixedDelayString = "${todly.notifications.due-scan-ms:3600000}")
    public void scanDue() {
        try {
            int created = notificationService.scanDue(LocalDate.now());
            if (created > 0) {
                log.info("Due scan created {} notification(s)", created);
            }
        } catch (Exception ex) {
            log.warn("Due notification scan failed", ex);
        }
    }
}
