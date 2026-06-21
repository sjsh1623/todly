package com.todly.room;

import com.todly.config.WebSocketConfig.StompPrincipal;
import com.todly.room.dto.LiveRoomDtos.MessageRequest;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.security.Principal;
import java.util.UUID;

/**
 * STOMP inbound for live-room cheers (§4.11): clients SEND to
 * {@code /app/rooms/{roomId}/cheer} with {@code {body?,emoji?}}. The sender's
 * identity comes from the STOMP {@link Principal} set at CONNECT. Effect is
 * identical to {@code POST /api/v1/live-rooms/{id}/messages}: persist + broadcast
 * {@code room.message} to {@code /topic/rooms/{roomId}} (the broadcast itself
 * goes through the Redis single-path inside {@link LiveRoomService}).
 */
@Controller
public class RoomStompController {

    private final LiveRoomService roomService;

    public RoomStompController(LiveRoomService roomService) {
        this.roomService = roomService;
    }

    @MessageMapping("/rooms/{roomId}/cheer")
    public void cheer(@DestinationVariable UUID roomId,
                      @Payload MessageRequest req,
                      Principal principal) {
        UUID userId = userId(principal);
        if (userId == null) {
            return; // unauthenticated CONNECT should be impossible, but be safe
        }
        // requireParticipant + persistence + broadcast all happen here.
        roomService.postMessage(roomId, userId, req.body(), req.emoji());
    }

    private UUID userId(Principal principal) {
        if (principal instanceof StompPrincipal sp) {
            return sp.userId();
        }
        if (principal != null) {
            try {
                return UUID.fromString(principal.getName());
            } catch (IllegalArgumentException ignored) {
                return null;
            }
        }
        return null;
    }
}
