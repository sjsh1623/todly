package com.todly.routine;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface RoutineStreakRepository extends JpaRepository<RoutineStreak, UUID> {
}
