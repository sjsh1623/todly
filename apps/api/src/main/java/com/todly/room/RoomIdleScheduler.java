package com.todly.room;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Auto-closes idle live rooms (IMP-22). Every minute it ends any LIVE room with
 * no active participants, or no message/photo activity for {@code IDLE_MINUTES}
 * (default 30), broadcasting {@code room.ended} for each via
 * {@link LiveRoomService#closeIdleRooms(int)}.
 *
 * <p>Single-instance scheduling is sufficient here. For multi-instance
 * deployments wrap the sweep with ShedLock (TODO) so only one node runs it.
 */
@Component
public class RoomIdleScheduler {

    private static final Logger log = LoggerFactory.getLogger(RoomIdleScheduler.class);

    private final LiveRoomService roomService;

    @Value("${todly.rooms.idle-minutes:30}")
    private int idleMinutes;

    public RoomIdleScheduler(LiveRoomService roomService) {
        this.roomService = roomService;
    }

    @Scheduled(fixedDelayString = "${todly.rooms.idle-sweep-ms:60000}")
    public void sweep() {
        try {
            int ended = roomService.closeIdleRooms(idleMinutes);
            if (ended > 0) {
                log.info("Idle sweep ended {} live room(s)", ended);
            }
        } catch (Exception ex) {
            log.warn("Idle room sweep failed", ex);
        }
    }
}
