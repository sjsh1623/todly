package com.todly.friend;

import com.todly.common.CurrentUser;
import com.todly.friend.dto.FriendDtos.SearchResultDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * User search for friend-adding (PHASE 8). Returns each hit with the relation
 * from the caller's perspective and a shared-group count.
 */
@RestController
@RequestMapping("/api/v1/users")
public class UserSearchController {

    private final FriendService friendService;

    public UserSearchController(FriendService friendService) {
        this.friendService = friendService;
    }

    @GetMapping("/search")
    public List<SearchResultDto> search(@RequestParam(required = false) String q) {
        return friendService.search(CurrentUser.id(), q);
    }
}
