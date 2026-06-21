package com.todly.room;

import com.todly.common.CurrentUser;
import com.todly.room.dto.LiveRoomDtos.CreateRoomRequest;
import com.todly.room.dto.LiveRoomDtos.MessageDto;
import com.todly.room.dto.LiveRoomDtos.MessageRequest;
import com.todly.room.dto.LiveRoomDtos.PhotoDto;
import com.todly.room.dto.LiveRoomDtos.RoomDetailDto;
import com.todly.room.dto.LiveRoomDtos.RoomDto;
import com.todly.room.dto.LiveRoomDtos.RoomListItem;
import com.todly.room.dto.LiveRoomDtos.RoomResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Live-room REST endpoints (PHASE 6). Authorization (group membership /
 * participant) is enforced in {@link LiveRoomService}.
 */
@RestController
@RequestMapping("/api/v1/live-rooms")
public class LiveRoomController {

    private final LiveRoomService roomService;

    public LiveRoomController(LiveRoomService roomService) {
        this.roomService = roomService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public RoomResponse create(@Valid @RequestBody CreateRoomRequest req) {
        return new RoomResponse(roomService.createOrJoin(req.taskId(), CurrentUser.id()));
    }

    @PostMapping("/{id}/join")
    public RoomResponse join(@PathVariable UUID id) {
        return new RoomResponse(roomService.join(id, CurrentUser.id()));
    }

    @PostMapping("/{id}/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void leave(@PathVariable UUID id) {
        roomService.leave(id, CurrentUser.id());
    }

    @PostMapping("/{id}/messages")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse message(@PathVariable UUID id, @RequestBody MessageRequest req) {
        MessageDto dto = roomService.postMessage(id, CurrentUser.id(), req.body(), req.emoji());
        return new MessageResponse(dto);
    }

    @PostMapping("/{id}/photos")
    @ResponseStatus(HttpStatus.CREATED)
    public PhotoResponse photo(@PathVariable UUID id,
                               @RequestParam("file") MultipartFile file) throws IOException {
        byte[] bytes = file.getBytes();
        PhotoDto dto = roomService.postPhoto(id, CurrentUser.id(), bytes, file.getContentType());
        return new PhotoResponse(dto);
    }

    @PostMapping("/{id}/end")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void end(@PathVariable UUID id) {
        roomService.end(id, CurrentUser.id());
    }

    @GetMapping("/{id}")
    public RoomDetailDto get(@PathVariable UUID id) {
        return roomService.detail(id, CurrentUser.id());
    }

    @GetMapping
    public List<RoomListItem> list(@RequestParam(value = "scope", required = false) String scope) {
        // Only "mine" is defined; default to it.
        return roomService.myActiveRooms(CurrentUser.id());
    }

    // --- response wrappers ------------------------------------------------

    public record MessageResponse(MessageDto message) {}

    public record PhotoResponse(PhotoDto photo) {}
}
