package com.todly.gamification;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface UserStatsRepository extends JpaRepository<UserStats, UUID> {
}
