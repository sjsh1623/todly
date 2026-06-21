package com.todly.notification;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface NotificationRepository extends JpaRepository<Notification, UUID> {

    /** First page of a user's notifications, newest first. */
    @Query("""
            select n from Notification n
            where n.userId = :userId
            order by n.createdAt desc, n.id desc
            """)
    List<Notification> findFeed(@Param("userId") UUID userId, Pageable pageable);

    /** Next page strictly older than the cursor (createdAt,id). */
    @Query("""
            select n from Notification n
            where n.userId = :userId
              and (n.createdAt < :cursorAt
                   or (n.createdAt = :cursorAt and n.id < :cursorId))
            order by n.createdAt desc, n.id desc
            """)
    List<Notification> findFeedAfter(@Param("userId") UUID userId,
                                     @Param("cursorAt") OffsetDateTime cursorAt,
                                     @Param("cursorId") UUID cursorId,
                                     Pageable pageable);

    @Query("select count(n) from Notification n where n.userId = :userId and n.isRead = false")
    long countUnread(@Param("userId") UUID userId);

    @Modifying
    @Query("update Notification n set n.isRead = true where n.userId = :userId and n.isRead = false")
    int markAllRead(@Param("userId") UUID userId);

    /**
     * Dedupe check for the due/overdue scanner: does a same-type notification for
     * the given task link already exist created on/after the given instant?
     */
    @Query("""
            select count(n) > 0 from Notification n
            where n.userId = :userId and n.type = :type and n.link = :link
              and n.createdAt >= :since
            """)
    boolean existsSince(@Param("userId") UUID userId,
                        @Param("type") NotificationType type,
                        @Param("link") String link,
                        @Param("since") OffsetDateTime since);
}
