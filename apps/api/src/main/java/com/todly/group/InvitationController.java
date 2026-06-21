package com.todly.group;

import com.todly.common.CurrentUser;
import com.todly.group.dto.GroupDtos.AcceptInvitationDto;
import com.todly.group.dto.GroupDtos.InvitationPreviewDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Invitation preview + accept (keyed by code). Both require authentication.
 */
@RestController
@RequestMapping("/api/v1/invitations")
public class InvitationController {

    private final GroupService groupService;

    public InvitationController(GroupService groupService) {
        this.groupService = groupService;
    }

    @GetMapping("/{code}")
    public InvitationPreviewDto preview(@PathVariable String code) {
        return groupService.previewInvitation(code, CurrentUser.id());
    }

    @PostMapping("/{code}/accept")
    public AcceptInvitationDto accept(@PathVariable String code) {
        return groupService.acceptInvitation(code, CurrentUser.id());
    }
}
