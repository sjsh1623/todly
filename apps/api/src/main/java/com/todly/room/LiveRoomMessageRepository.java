package com.todly.room;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface LiveRoomMessageRepository extends JpaRepository<LiveRoomMessage, UUID> {

    /** Most-recent messages first; caller reverses for chronological display. */
    @Query("""
            select m from LiveRoomMessage m
            where m.roomId = :roomId
            order by m.createdAt desc
            """)
    List<LiveRoomMessage> findRecentByRoom(@Param("roomId") UUID roomId, Pageable pageable);

    /** Timestamp of the latest message in a room (for the idle sweep). */
    @Query("select max(m.createdAt) from LiveRoomMessage m where m.roomId = :roomId")
    OffsetDateTime lastMessageAt(@Param("roomId") UUID roomId);
}
