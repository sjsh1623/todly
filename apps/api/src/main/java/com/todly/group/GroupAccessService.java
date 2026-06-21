package com.todly.group;

import com.todly.common.ApiException;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * Centralizes group membership + role authorization. Every group endpoint runs
 * its caller through this guard, which returns the caller's {@link GroupMember}
 * (proving membership of a non-soft-deleted group) or throws 403/404.
 */
@Service
public class GroupAccessService {

    private final GroupRepository groupRepository;
    private final GroupMemberRepository memberRepository;

    public GroupAccessService(GroupRepository groupRepository,
                              GroupMemberRepository memberRepository) {
        this.groupRepository = groupRepository;
        this.memberRepository = memberRepository;
    }

    /** @return the (active, non-deleted) group or 404. */
    @Transactional(readOnly = true)
    public Group requireGroup(UUID groupId) {
        return groupRepository.findActiveById(groupId)
            .orElseThrow(() -> ApiException.notFound("Group not found"));
    }

    /** @return the caller's membership, or 404 if group gone / 403 if not a member. */
    @Transactional(readOnly = true)
    public GroupMember requireMember(UUID groupId, UUID userId) {
        requireGroup(groupId);
        return memberRepository.findMembership(groupId, userId)
            .orElseThrow(() -> forbidden("You are not a member of this group"));
    }

    /** @return the caller's membership; throws 403 unless role is owner or admin. */
    @Transactional(readOnly = true)
    public GroupMember requireOwnerOrAdmin(UUID groupId, UUID userId) {
        GroupMember m = requireMember(groupId, userId);
        if (m.getRole() == MemberRole.member) {
            throw forbidden("Owner or admin role required");
        }
        return m;
    }

    /** @return the caller's membership; throws 403 unless role is owner. */
    @Transactional(readOnly = true)
    public GroupMember requireOwner(UUID groupId, UUID userId) {
        GroupMember m = requireMember(groupId, userId);
        if (m.getRole() != MemberRole.owner) {
            throw forbidden("Owner role required");
        }
        return m;
    }

    public static ApiException forbidden(String message) {
        return new ApiException(HttpStatus.FORBIDDEN, "FORBIDDEN", message);
    }
}
