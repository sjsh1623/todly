package com.todly.room;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LiveRoomRepository extends JpaRepository<LiveRoom, UUID> {

    /** The currently-live room for a task, if any (idempotent host-or-join). */
    @Query("""
            select r from LiveRoom r
            where r.taskId = :taskId and r.status = :status
            """)
    Optional<LiveRoom> findLiveByTask(@Param("taskId") UUID taskId,
                                      @Param("status") RoomStatus status);

    /** All rooms currently in the given status (used by the idle auto-close sweep). */
    @Query("select r from LiveRoom r where r.status = :status")
    List<LiveRoom> findByStatus(@Param("status") RoomStatus status);
}
