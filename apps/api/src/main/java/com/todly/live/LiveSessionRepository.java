package com.todly.live;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LiveSessionRepository extends JpaRepository<LiveSession, UUID> {

    /** The caller's current active (not yet ended) session, if any. */
    @Query("""
            select s from LiveSession s
            where s.userId = :userId and s.endedAt is null
            """)
    Optional<LiveSession> findActiveByUser(@Param("userId") UUID userId);

    /** The caller's active session for a specific task, if any. */
    @Query("""
            select s from LiveSession s
            where s.userId = :userId and s.taskId = :taskId and s.endedAt is null
            """)
    Optional<LiveSession> findActiveByUserAndTask(@Param("userId") UUID userId,
                                                  @Param("taskId") UUID taskId);

    /**
     * All active sessions across the groups the user belongs to, with the row
     * shape {@code [LiveSession, taskTitle, nickname, profileColor, groupId]}.
     */
    @Query("""
            select s, t.title, u.nickname, u.profileColor, g.id
            from LiveSession s
            join com.todly.task.Task t on t.id = s.taskId
            join t.group g
            join com.todly.user.User u on u.id = s.userId
            where s.endedAt is null
              and g.deletedAt is null
              and t.deletedAt is null
              and exists (
                  select 1 from com.todly.group.GroupMember m
                  where m.group.id = g.id and m.user.id = :userId
              )
            order by s.startedAt desc
            """)
    List<Object[]> findActiveAcrossUserGroups(@Param("userId") UUID userId);

    /** Count of the user's completed (ended) live sessions — contributes to lifeScore. */
    @Query("select count(s) from LiveSession s where s.userId = :userId and s.endedAt is not null")
    long countEndedByUser(@Param("userId") UUID userId);
}
