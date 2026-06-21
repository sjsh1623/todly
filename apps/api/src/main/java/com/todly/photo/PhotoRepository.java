package com.todly.photo;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public interface PhotoRepository extends JpaRepository<Photo, UUID> {

    /** Most-recent photos for a room first. */
    @Query("""
            select p from Photo p
            where p.roomId = :roomId
            order by p.createdAt desc
            """)
    List<Photo> findRecentByRoom(@Param("roomId") UUID roomId, Pageable pageable);

    /** Timestamp of the latest photo in a room (for the idle sweep). */
    @Query("select max(p.createdAt) from Photo p where p.roomId = :roomId")
    OffsetDateTime lastPhotoAt(@Param("roomId") UUID roomId);

    /** Photos attached to a task, oldest first (for task detail). */
    @Query("""
            select p from Photo p
            where p.taskId = :taskId
            order by p.createdAt asc
            """)
    List<Photo> findByTask(@Param("taskId") UUID taskId);
}
