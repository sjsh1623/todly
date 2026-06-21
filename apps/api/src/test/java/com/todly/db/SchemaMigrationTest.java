package com.todly.db;

import com.todly.group.Group;
import com.todly.group.GroupRepository;
import com.todly.group.GroupType;
import com.todly.task.Task;
import com.todly.task.TaskRepository;
import com.todly.task.TaskStatus;
import com.todly.user.ProfileColor;
import com.todly.user.User;
import com.todly.user.UserRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Proves the Flyway migration applies cleanly against a real PostgreSQL 16 and
 * that Hibernate `validate` accepts every entity mapping (context load), then
 * exercises a real CRUD path across users / groups / tasks.
 */
@Testcontainers
@SpringBootTest(properties = {
    "spring.flyway.enabled=true",
    "spring.jpa.hibernate.ddl-auto=validate",
    "spring.autoconfigure.exclude="
        + "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
        + "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration"
})
class SchemaMigrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private GroupRepository groupRepository;

    @Autowired
    private TaskRepository taskRepository;

    @Test
    void contextLoadsAndCrudWorks() {
        User user = new User();
        user.setEmail("test-" + UUID.randomUUID() + "@todly.dev");
        user.setUsername("u" + UUID.randomUUID().toString().substring(0, 8));
        user.setNickname("석현");
        user.setProfileColor(ProfileColor.blue);
        user = userRepository.save(user);
        assertThat(user.getId()).isNotNull();
        assertThat(user.getCreatedAt()).isNotNull();

        Group group = new Group();
        group.setName("이사 준비");
        group.setType(GroupType.group);
        group.setOwnerId(user.getId());
        group = groupRepository.save(group);
        assertThat(group.getId()).isNotNull();

        Task task = new Task();
        task.setGroup(group);
        task.setCreatorId(user.getId());
        task.setTitle("주방 정리하기");
        task.setStatus(TaskStatus.in_progress);
        task = taskRepository.save(task);
        assertThat(task.getId()).isNotNull();

        Optional<Task> reloaded = taskRepository.findById(task.getId());
        assertThat(reloaded).isPresent();
        assertThat(reloaded.get().getTitle()).isEqualTo("주방 정리하기");
        assertThat(reloaded.get().getStatus()).isEqualTo(TaskStatus.in_progress);
        assertThat(reloaded.get().getGroup().getId()).isEqualTo(group.getId());

        assertThat(userRepository.findById(user.getId())).isPresent();
        assertThat(groupRepository.findById(group.getId())).isPresent();
    }
}
