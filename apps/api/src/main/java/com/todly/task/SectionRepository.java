package com.todly.task;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface SectionRepository extends JpaRepository<Section, UUID> {

    /** Sections of a group ordered by position then creation time. */
    @Query("""
            select s from Section s
            where s.groupId = :groupId
            order by s.position asc, s.createdAt asc
            """)
    List<Section> findGroupSections(@Param("groupId") UUID groupId);
}
