package com.todly.home;

import com.todly.common.ApiException;
import com.todly.group.Group;
import com.todly.group.GroupMember;
import com.todly.group.GroupMemberRepository;
import com.todly.home.dto.HomeDtos.GreetingDto;
import com.todly.home.dto.HomeDtos.GroupProgressDto;
import com.todly.home.dto.HomeDtos.HomeSummaryDto;
import com.todly.home.dto.HomeDtos.LiveNowDto;
import com.todly.home.dto.HomeDtos.MemberBriefDto;
import com.todly.home.dto.HomeDtos.NeedsAttentionDto;
import com.todly.home.dto.HomeDtos.ProgressDto;
import com.todly.live.LiveSession;
import com.todly.live.LiveSessionRepository;
import com.todly.task.Task;
import com.todly.task.TaskRepository;
import com.todly.task.TaskStatus;
import com.todly.user.ProfileColor;
import com.todly.user.User;
import com.todly.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Home summary aggregation for PHASE 4: a greeting, the tasks assigned to me that
 * need attention (overdue / due today), and per-group progress. {@code liveNow}
 * is a placeholder filled in PHASE 5.
 */
@Service
public class HomeService {

    private final UserRepository userRepository;
    private final GroupMemberRepository memberRepository;
    private final TaskRepository taskRepository;
    private final LiveSessionRepository liveSessionRepository;

    public HomeService(UserRepository userRepository,
                       GroupMemberRepository memberRepository,
                       TaskRepository taskRepository,
                       LiveSessionRepository liveSessionRepository) {
        this.userRepository = userRepository;
        this.memberRepository = memberRepository;
        this.taskRepository = taskRepository;
        this.liveSessionRepository = liveSessionRepository;
    }

    @Transactional(readOnly = true)
    public HomeSummaryDto summary(UUID userId) {
        User me = userRepository.findById(userId)
            .orElseThrow(() -> ApiException.notFound("User not found"));
        LocalDate today = LocalDate.now();

        GreetingDto greeting = new GreetingDto(phraseForHour(java.time.LocalTime.now().getHour()),
            me.getNickname(), today);

        List<LiveNowDto> liveNow = new ArrayList<>();
        for (Object[] row : liveSessionRepository.findActiveAcrossUserGroups(userId)) {
            LiveSession s = (LiveSession) row[0];
            String taskTitle = (String) row[1];
            String nickname = (String) row[2];
            ProfileColor color = (ProfileColor) row[3];
            liveNow.add(new LiveNowDto(
                s.getUserId(), nickname, color.name(),
                s.getTaskId(), taskTitle, s.getStartedAt(), s.getStatus().name()));
        }

        List<NeedsAttentionDto> needsAttention = new ArrayList<>();
        for (Task t : taskRepository.findNeedsAttention(userId, today, TaskStatus.done)) {
            Group g = t.getGroup();
            boolean isToday = t.getDueDate().isEqual(today);
            String level = isToday ? "danger" : "warning";
            Long daysOverdue = isToday ? null : ChronoUnit.DAYS.between(t.getDueDate(), today);
            needsAttention.add(new NeedsAttentionDto(
                t.getId(), t.getTitle(),
                g != null ? g.getId() : null,
                g != null ? g.getName() : null,
                t.getDueDate(), level, daysOverdue));
        }

        List<GroupProgressDto> groupProgress = new ArrayList<>();
        for (GroupMember mine : memberRepository.findMyMemberships(userId)) {
            Group g = mine.getGroup();
            List<MemberBriefDto> members = new ArrayList<>();
            for (GroupMember m : memberRepository.findMembersWithUser(g.getId())) {
                members.add(new MemberBriefDto(
                    m.getUser().getId(), m.getUser().getNickname(),
                    m.getUser().getProfileColor().name()));
            }
            groupProgress.add(new GroupProgressDto(
                g.getId(), g.getName(), g.getColor(), progress(g.getId()), members));
        }

        return new HomeSummaryDto(greeting, liveNow, needsAttention, groupProgress);
    }

    private ProgressDto progress(UUID groupId) {
        long total = taskRepository.countTotal(groupId);
        long done = taskRepository.countByStatus(groupId, TaskStatus.done);
        int percent = total == 0 ? 0 : (int) Math.round(done * 100.0 / total);
        return new ProgressDto(percent, done, total);
    }

    private String phraseForHour(int hour) {
        if (hour < 12) {
            return "좋은 아침이에요";
        }
        if (hour < 18) {
            return "좋은 오후예요";
        }
        return "좋은 저녁이에요";
    }
}
