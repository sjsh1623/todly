package com.todly.user;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<User, UUID> {
    Optional<User> findByEmail(String email);
    Optional<User> findByUsername(String username);
    boolean existsByEmail(String email);
    boolean existsByUsername(String username);

    /** Active (non-soft-deleted) user by email — used for login. */
    Optional<User> findByEmailAndDeletedAtIsNull(String email);

    /** Active (non-soft-deleted) user by id — used for principal resolution. */
    Optional<User> findByIdAndDeletedAtIsNull(UUID id);

    /**
     * Search active users by username or nickname (case-insensitive substring),
     * excluding the caller. {@code q} should already be lower-cased and wrapped in
     * {@code %} wildcards by the caller. Username matches sort first.
     */
    @Query("""
            select u from User u
            where u.deletedAt is null
              and u.id <> :selfId
              and (lower(u.username) like :q or lower(u.nickname) like :q)
            order by case when lower(u.username) like :q then 0 else 1 end,
                     u.username asc
            """)
    List<User> search(@Param("q") String q, @Param("selfId") UUID selfId, Pageable pageable);
}
