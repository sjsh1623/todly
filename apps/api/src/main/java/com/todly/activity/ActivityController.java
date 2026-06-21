package com.todly.activity;

import com.todly.activity.dto.ActivityDtos.ActivityPageDto;
import com.todly.common.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Activity feed endpoints (PHASE 7, SCR-08). Both require authentication; the
 * per-group feed additionally enforces membership in {@link ActivityService}.
 */
@RestController
@RequestMapping("/api/v1")
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    /** A single group's feed (member required). */
    @GetMapping("/groups/{groupId}/activities")
    public ActivityPageDto groupFeed(@PathVariable UUID groupId,
                                     @RequestParam(required = false) String cursor,
                                     @RequestParam(defaultValue = "20") int limit) {
        return activityService.groupFeed(groupId, CurrentUser.id(), cursor, limit);
    }

    /** Merged "전체" feed across all of my groups. */
    @GetMapping("/activities")
    public ActivityPageDto mergedFeed(@RequestParam(required = false) String cursor,
                                      @RequestParam(defaultValue = "20") int limit) {
        return activityService.mergedFeed(CurrentUser.id(), cursor, limit);
    }
}
