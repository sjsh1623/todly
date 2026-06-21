package com.todly.realtime;

import com.todly.common.CurrentUser;
import com.todly.group.GroupMemberRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.ResponseBody;

import java.time.OffsetDateTime;

/**
 * Presence heartbeat. Clients call this periodically so {@code last_seen_at}
 * stays fresh for the group-detail "online" fallback (used when Redis presence
 * is unavailable or for the 2-minute last-seen window).
 */
@Controller
@RequestMapping("/api/v1/presence")
public class PresenceController {

    private final GroupMemberRepository memberRepository;

    public PresenceController(GroupMemberRepository memberRepository) {
        this.memberRepository = memberRepository;
    }

    @PostMapping("/heartbeat")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @ResponseBody
    @Transactional
    public void heartbeat() {
        memberRepository.touchAllForUser(CurrentUser.id(), OffsetDateTime.now());
    }
}
