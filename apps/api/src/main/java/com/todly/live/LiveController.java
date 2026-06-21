package com.todly.live;

import com.todly.common.CurrentUser;
import com.todly.live.dto.LiveDtos.PauseRequest;
import com.todly.live.dto.LiveDtos.SessionResponse;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Live-session endpoints. Membership is enforced in {@link LiveService}.
 */
@RestController
@RequestMapping("/api/v1/tasks/{id}/live")
public class LiveController {

    private final LiveService liveService;

    public LiveController(LiveService liveService) {
        this.liveService = liveService;
    }

    @PostMapping("/start")
    public SessionResponse start(@PathVariable UUID id) {
        return new SessionResponse(liveService.start(id, CurrentUser.id()));
    }

    @PostMapping("/pause")
    public SessionResponse pause(@PathVariable UUID id, @Valid @RequestBody PauseRequest req) {
        return new SessionResponse(liveService.pause(id, CurrentUser.id(), req.paused()));
    }

    @PostMapping("/stop")
    public Map<String, Object> stop(@PathVariable UUID id) {
        liveService.stop(id, CurrentUser.id());
        return Map.of();
    }
}
