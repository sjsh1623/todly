package com.todly.group;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface GroupMemberRepository extends JpaRepository<GroupMember, UUID> {

    /** The caller's membership of a (non-soft-deleted) group, if any. */
    @Query("""
            select m from GroupMember m
            where m.group.id = :groupId and m.user.id = :userId
              and m.group.deletedAt is null
            """)
    Optional<GroupMember> findMembership(@Param("groupId") UUID groupId,
                                         @Param("userId") UUID userId);

    /** All members of a group, eager user, ordered by join time (role sort in Java). */
    @Query("""
            select m from GroupMember m
            join fetch m.user u
            where m.group.id = :groupId
            order by m.joinedAt asc
            """)
    List<GroupMember> findMembersWithUser(@Param("groupId") UUID groupId);

    /** Active (non-soft-deleted) groups the user belongs to. */
    @Query("""
            select m from GroupMember m
            join fetch m.group g
            where m.user.id = :userId and g.deletedAt is null
            order by m.joinedAt asc
            """)
    List<GroupMember> findMyMemberships(@Param("userId") UUID userId);

    @Query("select count(m) from GroupMember m where m.group.id = :groupId")
    long countMembers(@Param("groupId") UUID groupId);

    /** Count of active (non-soft-deleted) groups both users belong to. */
    @Query("""
            select count(distinct m1.group.id) from GroupMember m1
            join GroupMember m2 on m2.group.id = m1.group.id
            where m1.user.id = :userA and m2.user.id = :userB
              and m1.group.deletedAt is null
            """)
    long countSharedGroups(@Param("userA") UUID userA, @Param("userB") UUID userB);

    /** Active group ids the user belongs to (cheap projection for shared-group math). */
    @Query("""
            select m.group.id from GroupMember m
            where m.user.id = :userId and m.group.deletedAt is null
            """)
    List<UUID> findActiveGroupIds(@Param("userId") UUID userId);

    @Query("""
            select count(m) > 0 from GroupMember m
            where m.group.id = :groupId and m.user.id = :userId
            """)
    boolean isMember(@Param("groupId") UUID groupId, @Param("userId") UUID userId);

    /** Refresh last_seen_at for one membership (used on STOMP connect). */
    @Modifying
    @Query("""
            update GroupMember m set m.lastSeenAt = :now
            where m.group.id = :groupId and m.user.id = :userId
            """)
    int touchLastSeen(@Param("groupId") UUID groupId,
                      @Param("userId") UUID userId,
                      @Param("now") OffsetDateTime now);

    /** Refresh last_seen_at across every group the user belongs to (heartbeat). */
    @Modifying
    @Query("update GroupMember m set m.lastSeenAt = :now where m.user.id = :userId")
    int touchAllForUser(@Param("userId") UUID userId, @Param("now") OffsetDateTime now);
}
