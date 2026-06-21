package com.todly.friend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Friendship persistence (PHASE 8).
 *
 * <p><b>Pair modeling.</b> A relationship between two users is represented by a
 * single row keyed on the unordered pair {@code (requesterId, addresseeId)}.
 * "Are A and B friends?" is true when a row exists in <em>either</em> direction
 * with {@code status = accepted}. The unique constraint is on the ordered pair,
 * so at most one row can exist per direction; the service is responsible for not
 * creating the mirror row.
 *
 * <p><b>Block modeling.</b> A block is a row with {@code status = blocked} where
 * the <em>blocker</em> is the {@code requesterId} and the <em>blocked</em> user
 * is the {@code addresseeId}. A blocked row hides the blocker from the blocked
 * user's search and prevents either side from sending new requests.
 *
 * <p>All enum comparisons use bound parameters (never enum literals in JPQL).
 * Existence/lookup queries are non-throwing so they are safe to call inside a
 * {@code @Transactional} write without risking a rollback-only marker.
 */
public interface FriendshipRepository extends JpaRepository<Friendship, UUID> {

    /** Any row between the two users in the given direction (a→b), if present. */
    @Query("""
            select f from Friendship f
            where f.requesterId = :a and f.addresseeId = :b
            """)
    Optional<Friendship> findDirectional(@Param("a") UUID a, @Param("b") UUID b);

    /** Any row between the two users in either direction, if present. */
    @Query("""
            select f from Friendship f
            where (f.requesterId = :a and f.addresseeId = :b)
               or (f.requesterId = :b and f.addresseeId = :a)
            """)
    Optional<Friendship> findBetween(@Param("a") UUID a, @Param("b") UUID b);

    /** True when an accepted friendship exists in either direction. */
    @Query("""
            select count(f) > 0 from Friendship f
            where f.status = :status
              and ((f.requesterId = :a and f.addresseeId = :b)
                or (f.requesterId = :b and f.addresseeId = :a))
            """)
    boolean existsAccepted(@Param("a") UUID a, @Param("b") UUID b,
                           @Param("status") FriendshipStatus status);

    /** Accepted friendships involving the user (either direction). */
    @Query("""
            select f from Friendship f
            where f.status = :status
              and (f.requesterId = :userId or f.addresseeId = :userId)
            order by f.respondedAt desc, f.createdAt desc
            """)
    List<Friendship> findAcceptedFor(@Param("userId") UUID userId,
                                     @Param("status") FriendshipStatus status);

    /** Pending requests addressed to the user (incoming). */
    @Query("""
            select f from Friendship f
            where f.addresseeId = :userId and f.status = :status
            order by f.createdAt desc
            """)
    List<Friendship> findIncoming(@Param("userId") UUID userId,
                                  @Param("status") FriendshipStatus status);

    /** Pending requests the user sent (outgoing). */
    @Query("""
            select f from Friendship f
            where f.requesterId = :userId and f.status = :status
            order by f.createdAt desc
            """)
    List<Friendship> findOutgoing(@Param("userId") UUID userId,
                                  @Param("status") FriendshipStatus status);

    /**
     * True when {@code blocker} has blocked {@code blocked}: a blocked-status row
     * with requester=blocker, addressee=blocked.
     */
    @Query("""
            select count(f) > 0 from Friendship f
            where f.requesterId = :blocker and f.addresseeId = :blocked
              and f.status = :status
            """)
    boolean isBlockedBy(@Param("blocker") UUID blocker, @Param("blocked") UUID blocked,
                        @Param("status") FriendshipStatus status);

    /** userIds who have blocked the given user (so they can be excluded from search). */
    @Query("""
            select f.requesterId from Friendship f
            where f.addresseeId = :userId and f.status = :status
            """)
    List<UUID> findBlockerIdsOf(@Param("userId") UUID userId,
                                @Param("status") FriendshipStatus status);
}
