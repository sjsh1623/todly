package com.todly.friend;

import com.todly.activity.ActivityService;
import com.todly.activity.ActivityType;
import com.todly.common.ApiException;
import com.todly.friend.dto.FriendDtos.FriendDto;
import com.todly.friend.dto.FriendDtos.InviteFriendsResultDto;
import com.todly.friend.dto.FriendDtos.IncomingRequestDto;
import com.todly.friend.dto.FriendDtos.OutgoingRequestDto;
import com.todly.friend.dto.FriendDtos.RequestBriefDto;
import com.todly.friend.dto.FriendDtos.RequestsDto;
import com.todly.friend.dto.FriendDtos.SearchResultDto;
import com.todly.friend.dto.FriendDtos.SendRequestBody;
import com.todly.friend.dto.FriendDtos.SendResultDto;
import com.todly.friend.dto.FriendDtos.UserBrief;
import com.todly.group.GroupAccessService;
import com.todly.group.GroupMember;
import com.todly.group.GroupMemberRepository;
import com.todly.group.MemberRole;
import com.todly.group.Group;
import com.todly.group.GroupRepository;
import com.todly.notification.NotificationService;
import com.todly.notification.NotificationType;
import com.todly.realtime.PresenceService;
import com.todly.user.User;
import com.todly.user.UserRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * Friend system business logic (PHASE 8): user search, friend requests,
 * accept/decline, unfriend, block/unblock, and direct-add of friends to a group.
 *
 * <p><b>Pair / block modeling</b> — see {@link FriendshipRepository}. One row per
 * ordered pair; friends = an accepted row in either direction; a block is a
 * {@code blocked} row whose {@code requesterId} is the blocker.
 *
 * <p><b>Auto-accept</b> — if A sends a request to B while B already has a pending
 * request to A (reverse direction), we accept the existing reverse row instead of
 * creating a duplicate, returning {@code status="accepted"}.
 *
 * <p><b>Decline</b> — the pending row is deleted (simplest; the pair becomes free
 * to re-request later).
 *
 * <p>Existence checks use non-throwing boolean queries so write transactions are
 * never marked rollback-only by a caught exception.
 */
@Service
public class FriendService {

    private static final int SEARCH_CAP = 20;
    private static final int PRESENCE_WINDOW_MINUTES = 2;

    private final FriendshipRepository friendships;
    private final UserRepository users;
    private final GroupMemberRepository members;
    private final GroupRepository groups;
    private final GroupAccessService access;
    private final NotificationService notifications;
    private final ActivityService activities;
    private final PresenceService presence;

    public FriendService(FriendshipRepository friendships,
                         UserRepository users,
                         GroupMemberRepository members,
                         GroupRepository groups,
                         GroupAccessService access,
                         NotificationService notifications,
                         ActivityService activities,
                         PresenceService presence) {
        this.friendships = friendships;
        this.users = users;
        this.members = members;
        this.groups = groups;
        this.access = access;
        this.notifications = notifications;
        this.activities = activities;
        this.presence = presence;
    }

    // --- search -----------------------------------------------------------

    @Transactional(readOnly = true)
    public List<SearchResultDto> search(UUID selfId, String q) {
        if (q == null || q.isBlank()) {
            return List.of();
        }
        String needle = q.trim().toLowerCase();
        if (needle.startsWith("@")) {
            needle = needle.substring(1);
        }
        if (needle.isBlank()) {
            return List.of();
        }
        String like = "%" + needle + "%";
        List<User> hits = users.search(like, selfId, PageRequest.of(0, SEARCH_CAP));

        // Hide users who have blocked me (best-effort privacy, IMP-24).
        Set<UUID> blockers = new HashSet<>(
            friendships.findBlockerIdsOf(selfId, FriendshipStatus.blocked));

        List<SearchResultDto> out = new ArrayList<>(hits.size());
        for (User u : hits) {
            if (blockers.contains(u.getId())) {
                continue;
            }
            out.add(new SearchResultDto(
                u.getId(), u.getUsername(), u.getNickname(), u.getProfileColor().name(),
                relationTo(selfId, u.getId()),
                members.countSharedGroups(selfId, u.getId())));
        }
        return out;
    }

    /** Relation from {@code self}'s perspective: none|friend|incoming|outgoing|blocked. */
    private String relationTo(UUID self, UUID other) {
        Friendship f = friendships.findBetween(self, other).orElse(null);
        if (f == null) {
            return "none";
        }
        return switch (f.getStatus()) {
            case accepted -> "friend";
            case blocked -> "blocked"; // either I blocked them or they blocked me
            case pending -> f.getRequesterId().equals(self) ? "outgoing" : "incoming";
        };
    }

    // --- friend list ------------------------------------------------------

    @Transactional(readOnly = true)
    public List<FriendDto> myFriends(UUID selfId) {
        List<Friendship> accepted = friendships.findAcceptedFor(selfId, FriendshipStatus.accepted);
        OffsetDateTime threshold = OffsetDateTime.now().minusMinutes(PRESENCE_WINDOW_MINUTES);

        List<FriendDto> out = new ArrayList<>(accepted.size());
        for (Friendship f : accepted) {
            UUID otherId = f.getRequesterId().equals(selfId)
                ? f.getAddresseeId() : f.getRequesterId();
            User u = users.findById(otherId).orElse(null);
            if (u == null || u.getDeletedAt() != null) {
                continue;
            }
            boolean online = u.getLastActiveAt() != null
                && u.getLastActiveAt().isAfter(threshold);
            out.add(new FriendDto(
                u.getId(), u.getUsername(), u.getNickname(), u.getProfileColor().name(),
                online, u.getLastActiveAt(),
                members.countSharedGroups(selfId, otherId)));
        }
        return out;
    }

    // --- requests view ----------------------------------------------------

    @Transactional(readOnly = true)
    public RequestsDto requests(UUID selfId) {
        List<IncomingRequestDto> incoming = new ArrayList<>();
        for (Friendship f : friendships.findIncoming(selfId, FriendshipStatus.pending)) {
            users.findById(f.getRequesterId()).ifPresent(u ->
                incoming.add(new IncomingRequestDto(f.getId(), brief(u), f.getCreatedAt())));
        }
        List<OutgoingRequestDto> outgoing = new ArrayList<>();
        for (Friendship f : friendships.findOutgoing(selfId, FriendshipStatus.pending)) {
            users.findById(f.getAddresseeId()).ifPresent(u ->
                outgoing.add(new OutgoingRequestDto(f.getId(), brief(u), f.getCreatedAt())));
        }
        return new RequestsDto(incoming, outgoing);
    }

    // --- send request -----------------------------------------------------

    @Transactional
    public SendResultDto sendRequest(UUID selfId, SendRequestBody body) {
        User target = resolveTarget(body);
        UUID targetId = target.getId();

        if (targetId.equals(selfId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SELF_REQUEST",
                "You cannot send a friend request to yourself");
        }

        // Block check (either direction prevents a request).
        if (friendships.isBlockedBy(targetId, selfId, FriendshipStatus.blocked)
            || friendships.isBlockedBy(selfId, targetId, FriendshipStatus.blocked)) {
            throw new ApiException(HttpStatus.FORBIDDEN, "BLOCKED",
                "A friend request cannot be sent to this user");
        }

        if (friendships.existsAccepted(selfId, targetId, FriendshipStatus.accepted)) {
            throw new ApiException(HttpStatus.CONFLICT, "ALREADY_FRIENDS",
                "You are already friends");
        }

        // Reverse pending → auto-accept.
        Friendship reverse = friendships.findDirectional(targetId, selfId).orElse(null);
        if (reverse != null && reverse.getStatus() == FriendshipStatus.pending) {
            reverse.setStatus(FriendshipStatus.accepted);
            reverse.setRespondedAt(OffsetDateTime.now());
            friendships.save(reverse);
            notifyAccepted(selfId, targetId);
            return new SendResultDto("accepted", null);
        }

        // My own pending already exists → conflict.
        Friendship mine = friendships.findDirectional(selfId, targetId).orElse(null);
        if (mine != null && mine.getStatus() == FriendshipStatus.pending) {
            throw new ApiException(HttpStatus.CONFLICT, "REQUEST_EXISTS",
                "A friend request is already pending");
        }

        // New pending request.
        Friendship f = new Friendship();
        f.setRequesterId(selfId);
        f.setAddresseeId(targetId);
        f.setStatus(FriendshipStatus.pending);
        friendships.save(f);

        User me = users.findById(selfId).orElse(null);
        String fromName = me != null ? me.getNickname() : "누군가";
        notifications.notify(targetId, NotificationType.friend_request,
            "새로운 친구 요청", fromName + "님이 친구 요청을 보냈어요", "/friends/requests");

        return new SendResultDto("pending",
            new RequestBriefDto(f.getId(), brief(target), f.getStatus().name(), f.getCreatedAt()));
    }

    // --- accept / decline -------------------------------------------------

    @Transactional
    public void accept(UUID selfId, UUID requestId) {
        Friendship f = friendships.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Friend request not found"));
        if (!f.getAddresseeId().equals(selfId)) {
            throw GroupAccessService.forbidden("Only the addressee may accept this request");
        }
        if (f.getStatus() != FriendshipStatus.pending) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE",
                "This request is not pending");
        }
        f.setStatus(FriendshipStatus.accepted);
        f.setRespondedAt(OffsetDateTime.now());
        friendships.save(f);
        notifyAccepted(f.getRequesterId(), selfId);
    }

    @Transactional
    public void decline(UUID selfId, UUID requestId) {
        Friendship f = friendships.findById(requestId)
            .orElseThrow(() -> ApiException.notFound("Friend request not found"));
        if (!f.getAddresseeId().equals(selfId)) {
            throw GroupAccessService.forbidden("Only the addressee may decline this request");
        }
        if (f.getStatus() != FriendshipStatus.pending) {
            throw new ApiException(HttpStatus.CONFLICT, "INVALID_STATE",
                "This request is not pending");
        }
        // Decline = delete the pending row (the pair becomes free to re-request).
        friendships.delete(f);
    }

    // --- unfriend ---------------------------------------------------------

    @Transactional
    public void unfriend(UUID selfId, UUID otherId) {
        Friendship f = friendships.findBetween(selfId, otherId)
            .filter(x -> x.getStatus() == FriendshipStatus.accepted)
            .orElseThrow(() -> ApiException.notFound("You are not friends with this user"));
        friendships.delete(f);
    }

    // --- block / unblock --------------------------------------------------

    @Transactional
    public void block(UUID selfId, UUID otherId) {
        if (otherId.equals(selfId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "SELF_BLOCK",
                "You cannot block yourself");
        }
        if (!users.existsById(otherId)) {
            throw ApiException.notFound("User not found");
        }
        // Remove any existing relationship/request in either direction, then upsert
        // a single blocked row with me as the blocker (requester).
        friendships.findBetween(selfId, otherId).ifPresent(friendships::delete);
        friendships.flush();

        Friendship blocked = new Friendship();
        blocked.setRequesterId(selfId);
        blocked.setAddresseeId(otherId);
        blocked.setStatus(FriendshipStatus.blocked);
        blocked.setRespondedAt(OffsetDateTime.now());
        friendships.save(blocked);
    }

    @Transactional
    public void unblock(UUID selfId, UUID otherId) {
        Friendship f = friendships.findDirectional(selfId, otherId)
            .filter(x -> x.getStatus() == FriendshipStatus.blocked)
            .orElseThrow(() -> ApiException.notFound("This user is not blocked"));
        friendships.delete(f);
    }

    // --- group invite-friends (direct add) --------------------------------

    @Transactional
    public InviteFriendsResultDto inviteFriendsToGroup(UUID groupId, UUID selfId, List<UUID> userIds) {
        // Authorize first (read-only guard); throws 403/404 before any writes.
        access.requireOwnerOrAdmin(groupId, selfId);
        Group group = access.requireGroup(groupId);

        List<UUID> added = new ArrayList<>();
        List<UUID> skipped = new ArrayList<>();
        Set<UUID> seen = new HashSet<>();

        for (UUID candidateId : userIds) {
            if (candidateId == null || candidateId.equals(selfId) || !seen.add(candidateId)) {
                if (candidateId != null) {
                    skipped.add(candidateId);
                }
                continue;
            }
            boolean isFriend = friendships.existsAccepted(selfId, candidateId, FriendshipStatus.accepted);
            if (!isFriend) {
                skipped.add(candidateId);
                continue;
            }
            if (members.isMember(groupId, candidateId)) {
                skipped.add(candidateId);
                continue;
            }
            User u = users.findById(candidateId).orElse(null);
            if (u == null || u.getDeletedAt() != null) {
                skipped.add(candidateId);
                continue;
            }

            GroupMember m = new GroupMember();
            m.setGroup(group);
            m.setUser(u);
            m.setRole(MemberRole.member);
            m.setLastSeenAt(OffsetDateTime.now());
            members.save(m);

            activities.record(groupId, candidateId, ActivityType.member_joined, null, null);
            notifications.notify(candidateId, NotificationType.invite,
                "그룹에 초대되었어요", group.getName() + " 그룹에 합류했어요",
                "/groups/" + groupId);

            added.add(candidateId);
        }
        return new InviteFriendsResultDto(added, skipped);
    }

    // --- helpers ----------------------------------------------------------

    private User resolveTarget(SendRequestBody body) {
        if (body != null && body.userId() != null) {
            return users.findById(body.userId())
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
                    "User not found"));
        }
        if (body != null && body.username() != null && !body.username().isBlank()) {
            String username = body.username().trim();
            if (username.startsWith("@")) {
                username = username.substring(1);
            }
            return users.findByUsername(username)
                .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "USER_NOT_FOUND",
                    "User not found"));
        }
        throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_ERROR",
            "username or userId is required");
    }

    private void notifyAccepted(UUID requesterId, UUID accepterId) {
        User accepter = users.findById(accepterId).orElse(null);
        String name = accepter != null ? accepter.getNickname() : "누군가";
        notifications.notify(requesterId, NotificationType.friend_accepted,
            "친구 요청이 수락되었어요", name + "님과 친구가 되었어요", "/friends");
    }

    private UserBrief brief(User u) {
        return new UserBrief(u.getId(), u.getUsername(), u.getNickname(),
            u.getProfileColor().name());
    }
}
