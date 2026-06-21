package com.todly.group;

import com.todly.common.ApiException;
import com.todly.group.dto.GroupDtos.AcceptInvitationDto;
import com.todly.group.dto.GroupDtos.CreateGroupRequest;
import com.todly.group.dto.GroupDtos.CreateInvitationRequest;
import com.todly.group.dto.GroupDtos.GroupDetailDto;
import com.todly.group.dto.GroupDtos.GroupSummaryDto;
import com.todly.group.dto.GroupDtos.InvitationCreatedDto;
import com.todly.group.dto.GroupDtos.InvitationPreviewDto;
import com.todly.group.dto.GroupDtos.InviteGroupDto;
import com.todly.group.dto.GroupDtos.MemberBriefDto;
import com.todly.group.dto.GroupDtos.MemberDto;
import com.todly.group.dto.GroupDtos.ProgressDto;
import com.todly.group.dto.GroupDtos.UpdateGroupRequest;
import com.todly.activity.ActivityService;
import com.todly.activity.ActivityType;
import com.todly.realtime.PresenceService;
import com.todly.task.TaskRepository;
import com.todly.user.User;
import com.todly.user.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Group, member and invitation business logic for PHASE 3.
 *
 * <p>Authorization is delegated to {@link GroupAccessService}; this service
 * focuses on the domain rules. Two policies worth calling out:
 *
 * <ul>
 *   <li><b>Multi-use invites</b>: accepting an invitation does <em>not</em>
 *       consume it. A link stays {@code pending} and usable until it expires or
 *       is revoked, so one link can onboard many members.</li>
 *   <li><b>Ownership delegation</b>: PATCH members/{id} {role:owner} is allowed
 *       for the current owner only. It atomically demotes the previous owner to
 *       {@code admin} and updates {@code groups.owner_id}, guaranteeing exactly
 *       one owner. The former owner may then leave.</li>
 * </ul>
 */
@Service
public class GroupService {

    private static final int PRESENCE_WINDOW_MINUTES = 2;
    private static final int MEMBER_BRIEF_CAP = 6;
    private static final int DEFAULT_INVITE_HOURS = 168;
    private static final String INVITE_ALPHABET =
        "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

    private final GroupRepository groupRepository;
    private final GroupMemberRepository memberRepository;
    private final InvitationRepository invitationRepository;
    private final TaskRepository taskRepository;
    private final UserRepository userRepository;
    private final GroupAccessService access;
    private final PresenceService presenceService;
    private final ActivityService activityService;
    private final SecureRandom random = new SecureRandom();

    public GroupService(GroupRepository groupRepository,
                        GroupMemberRepository memberRepository,
                        InvitationRepository invitationRepository,
                        TaskRepository taskRepository,
                        UserRepository userRepository,
                        GroupAccessService access,
                        PresenceService presenceService,
                        ActivityService activityService) {
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
        this.invitationRepository = invitationRepository;
        this.taskRepository = taskRepository;
        this.userRepository = userRepository;
        this.access = access;
        this.presenceService = presenceService;
        this.activityService = activityService;
    }

    // --- groups -----------------------------------------------------------

    @Transactional(readOnly = true)
    public List<GroupSummaryDto> myGroups(UUID userId) {
        List<GroupMember> memberships = memberRepository.findMyMemberships(userId);
        List<GroupSummaryDto> out = new ArrayList<>(memberships.size());
        for (GroupMember mine : memberships) {
            Group g = mine.getGroup();
            List<GroupMember> members = sortedByRole(memberRepository.findMembersWithUser(g.getId()));
            List<MemberBriefDto> brief = new ArrayList<>();
            for (int i = 0; i < members.size() && i < MEMBER_BRIEF_CAP; i++) {
                brief.add(toBrief(members.get(i)));
            }
            out.add(new GroupSummaryDto(
                g.getId(), g.getName(), g.getType(), g.getColor(), g.getIcon(),
                members.size(), mine.getRole(), progress(g.getId()), brief));
        }
        return out;
    }

    @Transactional
    public GroupDetailDto createGroup(UUID userId, CreateGroupRequest req) {
        User me = userRepository.findById(userId)
            .orElseThrow(() -> ApiException.notFound("User not found"));

        Group g = new Group();
        g.setName(req.name().trim());
        g.setType(req.type());
        g.setColor(req.color());
        g.setIcon(req.icon());
        g.setDescription(req.description());
        g.setOwnerId(userId);
        groupRepository.save(g);

        GroupMember owner = new GroupMember();
        owner.setGroup(g);
        owner.setUser(me);
        owner.setRole(MemberRole.owner);
        owner.setLastSeenAt(OffsetDateTime.now());
        memberRepository.save(owner);

        return detail(g.getId(), userId);
    }

    @Transactional(readOnly = true)
    public GroupDetailDto getGroup(UUID groupId, UUID userId) {
        access.requireMember(groupId, userId);
        return detail(groupId, userId);
    }

    @Transactional
    public GroupDetailDto updateGroup(UUID groupId, UUID userId, UpdateGroupRequest req) {
        access.requireOwner(groupId, userId);
        Group g = access.requireGroup(groupId);
        if (req.name() != null) {
            g.setName(req.name().trim());
        }
        if (req.color() != null) {
            g.setColor(req.color());
        }
        if (req.icon() != null) {
            g.setIcon(req.icon());
        }
        if (req.description() != null) {
            g.setDescription(req.description());
        }
        groupRepository.save(g);
        return detail(groupId, userId);
    }

    @Transactional
    public void deleteGroup(UUID groupId, UUID userId) {
        access.requireOwner(groupId, userId);
        Group g = access.requireGroup(groupId);
        g.setDeletedAt(OffsetDateTime.now());
        groupRepository.save(g);
    }

    // --- invitations ------------------------------------------------------

    @Transactional
    public InvitationCreatedDto createInvitation(UUID groupId, UUID userId,
                                                 CreateInvitationRequest req) {
        access.requireOwnerOrAdmin(groupId, userId);
        int hours = (req != null && req.expiresInHours() != null)
            ? req.expiresInHours() : DEFAULT_INVITE_HOURS;
        OffsetDateTime expiresAt = OffsetDateTime.now().plus(Duration.ofHours(hours));

        Invitation inv = new Invitation();
        inv.setGroupId(groupId);
        inv.setInviterId(userId);
        inv.setCode(generateUniqueCode());
        inv.setStatus(InvitationStatus.pending);
        inv.setExpiresAt(expiresAt);
        invitationRepository.save(inv);

        return new InvitationCreatedDto(inv.getCode(), "/invite/" + inv.getCode(), expiresAt);
    }

    @Transactional(readOnly = true)
    public InvitationPreviewDto previewInvitation(String code, UUID userId) {
        Invitation inv = invitationRepository.findByCode(code)
            .orElseThrow(() -> ApiException.notFound("Invitation not found"));
        Group g = groupRepository.findActiveById(inv.getGroupId())
            .orElseThrow(() -> ApiException.notFound("Invitation not found"));
        boolean expired = isExpired(inv);
        InviteGroupDto group = new InviteGroupDto(
            g.getId(), g.getName(), g.getColor(), g.getType(),
            memberRepository.countMembers(g.getId()));
        return new InvitationPreviewDto(group, inv.getStatus().name(), expired);
    }

    @Transactional
    public AcceptInvitationDto acceptInvitation(String code, UUID userId) {
        Invitation inv = invitationRepository.findByCode(code)
            .orElseThrow(() -> ApiException.notFound("Invitation not found"));
        Group g = groupRepository.findActiveById(inv.getGroupId())
            .orElseThrow(() -> ApiException.notFound("Invitation not found"));

        if (isExpired(inv)) {
            throw new ApiException(HttpStatus.GONE, "INVITATION_EXPIRED",
                "This invitation has expired");
        }
        if (memberRepository.isMember(g.getId(), userId)) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_MEMBER",
                "You are already a member of this group");
        }

        User me = userRepository.findById(userId)
            .orElseThrow(() -> ApiException.notFound("User not found"));
        GroupMember member = new GroupMember();
        member.setGroup(g);
        member.setUser(me);
        member.setRole(MemberRole.member);
        member.setLastSeenAt(OffsetDateTime.now());
        memberRepository.save(member);

        // Feed: the new member joined (broadcasts activity.created to the group).
        activityService.record(g.getId(), userId, ActivityType.member_joined, null, null);

        // MULTI-USE: invitation is intentionally NOT consumed here.
        return new AcceptInvitationDto(g.getId());
    }

    // --- members ----------------------------------------------------------

    @Transactional
    public MemberDto updateMemberRole(UUID groupId, UUID targetUserId,
                                      UUID actorId, MemberRole newRole) {
        GroupMember actor = access.requireMember(groupId, actorId);
        GroupMember target = memberRepository.findMembership(groupId, targetUserId)
            .orElseThrow(() -> ApiException.notFound("Member not found"));

        // Nobody may change the owner's role through this endpoint...
        if (target.getRole() == MemberRole.owner) {
            throw GroupAccessService.forbidden("Cannot change the owner's role");
        }

        if (newRole == MemberRole.owner) {
            // ...except via ownership delegation, allowed for the current owner only.
            if (actor.getRole() != MemberRole.owner) {
                throw GroupAccessService.forbidden("Only the owner can delegate ownership");
            }
            delegateOwnership(groupId, actor, target);
            return toMember(target);
        }

        switch (actor.getRole()) {
            case owner -> {
                // owner may set admin/member on others (target is not owner here)
            }
            case admin -> {
                // admin may only manage plain members (not other admins/owner)
                if (target.getRole() != MemberRole.member) {
                    throw GroupAccessService.forbidden("Admins may only manage plain members");
                }
            }
            default -> throw GroupAccessService.forbidden("Owner or admin role required");
        }

        target.setRole(newRole);
        memberRepository.save(target);
        return toMember(target);
    }

    @Transactional
    public void removeMember(UUID groupId, UUID targetUserId, UUID actorId) {
        GroupMember actor = access.requireMember(groupId, actorId);
        GroupMember target = memberRepository.findMembership(groupId, targetUserId)
            .orElseThrow(() -> ApiException.notFound("Member not found"));

        boolean selfLeave = actor.getUser().getId().equals(targetUserId);

        if (selfLeave) {
            // Owner cannot leave without delegating first.
            if (actor.getRole() == MemberRole.owner) {
                throw new ApiException(HttpStatus.CONFLICT, "OWNER_MUST_DELEGATE",
                    "Delegate ownership before leaving the group");
            }
            memberRepository.delete(target);
            return;
        }

        // Kick path: only owner/admin may kick.
        if (actor.getRole() == MemberRole.member) {
            throw GroupAccessService.forbidden("Owner or admin role required");
        }
        if (actor.getRole() == MemberRole.admin
            && target.getRole() != MemberRole.member) {
            throw GroupAccessService.forbidden("Admins cannot kick owners or admins");
        }
        // owner may kick admin/member; never the owner (only one, == self handled above)
        if (target.getRole() == MemberRole.owner) {
            throw GroupAccessService.forbidden("Cannot remove the owner");
        }
        memberRepository.delete(target);
    }

    // --- helpers ----------------------------------------------------------

    /** Atomically promote target to owner and demote the current owner to admin. */
    private void delegateOwnership(UUID groupId, GroupMember currentOwner, GroupMember target) {
        target.setRole(MemberRole.owner);
        currentOwner.setRole(MemberRole.admin);
        memberRepository.save(target);
        memberRepository.save(currentOwner);

        Group g = access.requireGroup(groupId);
        g.setOwnerId(target.getUser().getId());
        groupRepository.save(g);
    }

    private GroupDetailDto detail(UUID groupId, UUID userId) {
        Group g = access.requireGroup(groupId);
        GroupMember mine = memberRepository.findMembership(groupId, userId)
            .orElseThrow(() -> GroupAccessService.forbidden("You are not a member of this group"));
        List<GroupMember> members = sortedByRole(memberRepository.findMembersWithUser(groupId));
        OffsetDateTime threshold = OffsetDateTime.now().minusMinutes(PRESENCE_WINDOW_MINUTES);
        // Prefer live Redis presence when available; otherwise fall back to the
        // last_seen_at 2-minute window (kept fresh by the heartbeat endpoint).
        boolean useRedis = presenceService.redisAvailable();

        List<MemberDto> memberDtos = new ArrayList<>(members.size());
        long onlineCount = 0;
        for (GroupMember m : members) {
            boolean online = useRedis
                ? presenceService.isOnline(groupId, m.getUser().getId())
                : (m.getLastSeenAt() != null && m.getLastSeenAt().isAfter(threshold));
            if (online) {
                onlineCount++;
            }
            memberDtos.add(new MemberDto(
                m.getUser().getId(), m.getUser().getUsername(), m.getUser().getNickname(),
                m.getUser().getProfileColor().name(), m.getRole(), online, m.getLastSeenAt()));
        }

        return new GroupDetailDto(
            g.getId(), g.getName(), g.getType(), g.getColor(), g.getIcon(),
            g.getDescription(), g.getOwnerId(), mine.getRole(),
            members.size(), onlineCount, progress(groupId), memberDtos);
    }

    private ProgressDto progress(UUID groupId) {
        long total = taskRepository.countTotal(groupId);
        long done = taskRepository.countByStatus(groupId, com.todly.task.TaskStatus.done);
        int percent = total == 0 ? 0 : (int) Math.round(done * 100.0 / total);
        return new ProgressDto(percent, done, total);
    }

    /** Order members owner -> admin -> member, preserving join order within a role. */
    private List<GroupMember> sortedByRole(List<GroupMember> members) {
        List<GroupMember> copy = new ArrayList<>(members);
        copy.sort(java.util.Comparator.comparingInt(m -> switch (m.getRole()) {
            case owner -> 0;
            case admin -> 1;
            case member -> 2;
        }));
        return copy;
    }

    private MemberBriefDto toBrief(GroupMember m) {
        return new MemberBriefDto(
            m.getUser().getId(), m.getUser().getUsername(), m.getUser().getNickname(),
            m.getUser().getProfileColor().name(), m.getRole());
    }

    private MemberDto toMember(GroupMember m) {
        OffsetDateTime threshold = OffsetDateTime.now().minusMinutes(PRESENCE_WINDOW_MINUTES);
        boolean online = m.getLastSeenAt() != null && m.getLastSeenAt().isAfter(threshold);
        return new MemberDto(
            m.getUser().getId(), m.getUser().getUsername(), m.getUser().getNickname(),
            m.getUser().getProfileColor().name(), m.getRole(), online, m.getLastSeenAt());
    }

    private boolean isExpired(Invitation inv) {
        if (inv.getStatus() == InvitationStatus.expired
            || inv.getStatus() == InvitationStatus.revoked) {
            return true;
        }
        return inv.getExpiresAt() != null
            && inv.getExpiresAt().isBefore(OffsetDateTime.now());
    }

    private String generateUniqueCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            int len = 8 + random.nextInt(3); // 8-10 chars
            StringBuilder sb = new StringBuilder(len);
            for (int i = 0; i < len; i++) {
                sb.append(INVITE_ALPHABET.charAt(random.nextInt(INVITE_ALPHABET.length())));
            }
            String code = sb.toString();
            if (invitationRepository.findByCode(code).isEmpty()) {
                return code;
            }
        }
        throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR",
            "Could not generate a unique invitation code");
    }
}
