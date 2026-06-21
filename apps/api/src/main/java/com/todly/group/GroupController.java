package com.todly.group;

import com.todly.common.CurrentUser;
import com.todly.friend.FriendService;
import com.todly.friend.dto.FriendDtos.InviteFriendsBody;
import com.todly.friend.dto.FriendDtos.InviteFriendsResultDto;
import com.todly.group.dto.GroupDtos.CreateGroupRequest;
import com.todly.group.dto.GroupDtos.CreateInvitationRequest;
import com.todly.group.dto.GroupDtos.GroupDetailDto;
import com.todly.group.dto.GroupDtos.GroupSummaryDto;
import com.todly.group.dto.GroupDtos.InvitationCreatedDto;
import com.todly.group.dto.GroupDtos.MemberDto;
import com.todly.group.dto.GroupDtos.UpdateGroupRequest;
import com.todly.group.dto.GroupDtos.UpdateMemberRoleRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Group, member and invitation-creation endpoints. All require authentication;
 * membership/role checks are enforced in {@link GroupService} via
 * {@link GroupAccessService}.
 */
@RestController
@RequestMapping("/api/v1/groups")
public class GroupController {

    private final GroupService groupService;
    private final FriendService friendService;

    public GroupController(GroupService groupService, FriendService friendService) {
        this.groupService = groupService;
        this.friendService = friendService;
    }

    @GetMapping
    public List<GroupSummaryDto> myGroups() {
        return groupService.myGroups(CurrentUser.id());
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public GroupDetailDto create(@Valid @RequestBody CreateGroupRequest req) {
        return groupService.createGroup(CurrentUser.id(), req);
    }

    @GetMapping("/{id}")
    public GroupDetailDto get(@PathVariable UUID id) {
        return groupService.getGroup(id, CurrentUser.id());
    }

    @PatchMapping("/{id}")
    public GroupDetailDto update(@PathVariable UUID id,
                                 @Valid @RequestBody UpdateGroupRequest req) {
        return groupService.updateGroup(id, CurrentUser.id(), req);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        groupService.deleteGroup(id, CurrentUser.id());
    }

    @PostMapping("/{id}/invitations")
    @ResponseStatus(HttpStatus.CREATED)
    public InvitationCreatedDto createInvitation(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) CreateInvitationRequest req) {
        return groupService.createInvitation(id, CurrentUser.id(), req);
    }

    @PostMapping("/{id}/invite-friends")
    public InviteFriendsResultDto inviteFriends(@PathVariable UUID id,
                                                @Valid @RequestBody InviteFriendsBody body) {
        return friendService.inviteFriendsToGroup(id, CurrentUser.id(), body.userIds());
    }

    @PatchMapping("/{id}/members/{userId}")
    public MemberDto updateMemberRole(@PathVariable UUID id,
                                      @PathVariable UUID userId,
                                      @Valid @RequestBody UpdateMemberRoleRequest req) {
        return groupService.updateMemberRole(id, userId, CurrentUser.id(), req.role());
    }

    @DeleteMapping("/{id}/members/{userId}")
    public ResponseEntity<Void> removeMember(@PathVariable UUID id,
                                             @PathVariable UUID userId) {
        groupService.removeMember(id, userId, CurrentUser.id());
        return ResponseEntity.noContent().build();
    }
}
