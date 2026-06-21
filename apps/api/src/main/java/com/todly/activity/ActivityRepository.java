package com.todly.activity;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface ActivityRepository extends JpaRepository<Activity, UUID> {

    /** First page of a group's feed, newest first (createdAt desc, id desc tiebreak). */
    @Query("""
            select a from Activity a
            where a.groupId = :groupId
            order by a.createdAt desc, a.id desc
            """)
    List<Activity> findGroupFeed(@Param("groupId") UUID groupId, Pageable pageable);

    /** Next page of a group's feed strictly older than the cursor (createdAt,id). */
    @Query("""
            select a from Activity a
            where a.groupId = :groupId
              and (a.createdAt < :cursorAt
                   or (a.createdAt = :cursorAt and a.id < :cursorId))
            order by a.createdAt desc, a.id desc
            """)
    List<Activity> findGroupFeedAfter(@Param("groupId") UUID groupId,
                                      @Param("cursorAt") OffsetDateTime cursorAt,
                                      @Param("cursorId") UUID cursorId,
                                      Pageable pageable);

    /** First page of the merged feed across the given groups, newest first. */
    @Query("""
            select a from Activity a
            where a.groupId in :groupIds
            order by a.createdAt desc, a.id desc
            """)
    List<Activity> findMergedFeed(@Param("groupIds") List<UUID> groupIds, Pageable pageable);

    /** Next page of the merged feed strictly older than the cursor. */
    @Query("""
            select a from Activity a
            where a.groupId in :groupIds
              and (a.createdAt < :cursorAt
                   or (a.createdAt = :cursorAt and a.id < :cursorId))
            order by a.createdAt desc, a.id desc
            """)
    List<Activity> findMergedFeedAfter(@Param("groupIds") List<UUID> groupIds,
                                       @Param("cursorAt") OffsetDateTime cursorAt,
                                       @Param("cursorId") UUID cursorId,
                                       Pageable pageable);
}
