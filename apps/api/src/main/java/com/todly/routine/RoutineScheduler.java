package com.todly.routine;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Materializes due routines into task instances (PHASE 7, §3.5). Runs every 60s
 * and delegates to the TESTABLE {@link RoutineService#materializeDue(Instant)} so
 * tests can drive it deterministically without the timer.
 *
 * <p>Single-instance scheduling assumed; wrap with ShedLock for multi-node.
 */
@Component
public class RoutineScheduler {

    private static final Logger log = LoggerFactory.getLogger(RoutineScheduler.class);

    private final RoutineService routineService;

    public RoutineScheduler(RoutineService routineService) {
        this.routineService = routineService;
    }

    @Scheduled(fixedDelayString = "${todly.routines.materialize-ms:60000}")
    public void materialize() {
        try {
            int created = routineService.materializeDue(Instant.now());
            if (created > 0) {
                log.info("Routine materializer created {} task instance(s)", created);
            }
        } catch (Exception ex) {
            log.warn("Routine materialization failed", ex);
        }
    }
}
