package com.todly.room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LiveRoomParticipantRepository
        extends JpaRepository<LiveRoomParticipant, LiveRoomParticipantId> {

    /** All participants of a room ordered by join time (active + left). */
    @Query("""
            select p from LiveRoomParticipant p
            where p.id.roomId = :roomId
            order by p.joinedAt asc
            """)
    List<LiveRoomParticipant> findByRoom(@Param("roomId") UUID roomId);

    /** Active (not-left) participants of a room. */
    @Query("""
            select p from LiveRoomParticipant p
            where p.id.roomId = :roomId and p.leftAt is null
            order by p.joinedAt asc
            """)
    List<LiveRoomParticipant> findActiveByRoom(@Param("roomId") UUID roomId);

    @Query("""
            select count(p) from LiveRoomParticipant p
            where p.id.roomId = :roomId and p.leftAt is null
            """)
    long countActiveByRoom(@Param("roomId") UUID roomId);

    /** True if the user is an active participant of the room. */
    @Query("""
            select count(p) > 0 from LiveRoomParticipant p
            where p.id.roomId = :roomId and p.id.userId = :userId and p.leftAt is null
            """)
    boolean isActiveParticipant(@Param("roomId") UUID roomId, @Param("userId") UUID userId);

    Optional<LiveRoomParticipant> findById(LiveRoomParticipantId id);
}
