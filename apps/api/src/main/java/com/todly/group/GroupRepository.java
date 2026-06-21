package com.todly.group;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;
import java.util.UUID;

public interface GroupRepository extends JpaRepository<Group, UUID> {

    /** Fetch a non-soft-deleted group by id. */
    @Query("select g from Group g where g.id = :id and g.deletedAt is null")
    Optional<Group> findActiveById(@Param("id") UUID id);
}
