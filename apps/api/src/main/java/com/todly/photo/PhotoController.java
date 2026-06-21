package com.todly.photo;

import com.todly.common.ApiException;
import com.todly.common.CurrentUser;
import com.todly.room.LiveRoomService;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.InputStream;
import java.util.UUID;

/**
 * Serves stored photo bytes. Group-membership (via the photo's room) is enforced
 * by {@link LiveRoomService#requirePhotoForViewer} before any bytes are read.
 */
@RestController
@RequestMapping("/api/v1/photos")
public class PhotoController {

    private final LiveRoomService roomService;

    public PhotoController(LiveRoomService roomService) {
        this.roomService = roomService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<InputStreamResource> full(@PathVariable UUID id) {
        Photo photo = roomService.requirePhotoForViewer(id, CurrentUser.id());
        return serve(id.toString(), MediaType.IMAGE_JPEG_VALUE);
    }

    @GetMapping("/{id}/thumb")
    public ResponseEntity<InputStreamResource> thumb(@PathVariable UUID id) {
        Photo photo = roomService.requirePhotoForViewer(id, CurrentUser.id());
        return serve(id + "-thumb", MediaType.IMAGE_PNG_VALUE);
    }

    private ResponseEntity<InputStreamResource> serve(String key, String fallbackType) {
        if (!roomService.storage().exists(key)) {
            throw ApiException.notFound("Photo bytes not found");
        }
        String contentType = roomService.storedContentType(key, fallbackType);
        try {
            InputStream in = roomService.storage().get(key);
            return ResponseEntity.status(HttpStatus.OK)
                .contentType(MediaType.parseMediaType(contentType))
                .body(new InputStreamResource(in));
        } catch (IOException e) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "STORAGE_ERROR",
                "Failed to read the image");
        }
    }
}
