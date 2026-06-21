package com.todly.friend;

import com.todly.common.CurrentUser;
import com.todly.friend.dto.FriendDtos.FriendDto;
import com.todly.friend.dto.FriendDtos.RequestsDto;
import com.todly.friend.dto.FriendDtos.SendRequestBody;
import com.todly.friend.dto.FriendDtos.SendResultDto;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Friend list, requests, accept/decline, unfriend and block endpoints (PHASE 8).
 * All require authentication; relationship participation is enforced in
 * {@link FriendService}.
 */
@RestController
@RequestMapping("/api/v1/friends")
public class FriendController {

    private final FriendService friendService;

    public FriendController(FriendService friendService) {
        this.friendService = friendService;
    }

    @GetMapping
    public List<FriendDto> friends() {
        return friendService.myFriends(CurrentUser.id());
    }

    @GetMapping("/requests")
    public RequestsDto requests() {
        return friendService.requests(CurrentUser.id());
    }

    @PostMapping("/requests")
    public ResponseEntity<SendResultDto> sendRequest(@RequestBody SendRequestBody body) {
        SendResultDto result = friendService.sendRequest(CurrentUser.id(), body);
        // Auto-accept returns 200; a genuinely new pending request returns 201.
        HttpStatus status = "accepted".equals(result.status())
            ? HttpStatus.OK : HttpStatus.CREATED;
        return ResponseEntity.status(status).body(result);
    }

    @PostMapping("/requests/{id}/accept")
    public ResponseEntity<Void> accept(@PathVariable UUID id) {
        friendService.accept(CurrentUser.id(), id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/requests/{id}/decline")
    public ResponseEntity<Void> decline(@PathVariable UUID id) {
        friendService.decline(CurrentUser.id(), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<Void> unfriend(@PathVariable UUID userId) {
        friendService.unfriend(CurrentUser.id(), userId);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{userId}/block")
    public ResponseEntity<Void> block(@PathVariable UUID userId) {
        friendService.block(CurrentUser.id(), userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{userId}/block")
    public ResponseEntity<Void> unblock(@PathVariable UUID userId) {
        friendService.unblock(CurrentUser.id(), userId);
        return ResponseEntity.noContent().build();
    }
}
