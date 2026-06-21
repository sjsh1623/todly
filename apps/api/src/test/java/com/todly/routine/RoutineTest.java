package com.todly.routine;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.todly.task.Task;
import com.todly.task.TaskRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PHASE 7 routine proof against real PostgreSQL 16 + Redis (Testcontainers).
 *
 * <p>Drives the TESTABLE {@link RoutineService#materializeDue(Instant)} directly
 * (no timer) and the REST surface for create/complete/toggle. Asserts: an
 * instance Task is materialized (routine_id + dueDate today), no duplicate on a
 * second run, complete writes a routine_logs row + streak current=1, consecutive
 * simulated days increment the streak, and an inactive routine is not materialized.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
    })
class RoutineTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

    @Container
    static final GenericContainer<?> REDIS =
        new GenericContainer<>(DockerImageName.parse("redis:7")).withExposedPorts(6379);

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.data.redis.host", REDIS::getHost);
        registry.add("spring.data.redis.port", () -> REDIS.getMappedPort(6379));
        registry.add("spring.data.redis.url", () ->
            "redis://" + REDIS.getHost() + ":" + REDIS.getMappedPort(6379));
    }

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    RoutineService routineService;

    @Autowired
    RoutineRepository routineRepository;

    @Autowired
    RoutineLogRepository logRepository;

    @Autowired
    RoutineStreakRepository streakRepository;

    @Autowired
    TaskRepository taskRepository;

    private record Account(String token, String userId) {}

    private HttpHeaders json(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            h.setBearerAuth(token);
        }
        return h;
    }

    private ResponseEntity<String> exchange(String token, HttpMethod method, String path, String body) {
        return rest.exchange("http://localhost:" + port + path, method,
            new HttpEntity<>(body, json(token)), String.class);
    }

    private JsonNode post(String token, String path, String body) {
        ResponseEntity<String> res = exchange(token, HttpMethod.POST, path, body);
        assertThat(res.getStatusCode().is2xxSuccessful())
            .as("POST %s -> %s : %s", path, res.getStatusCode(), res.getBody()).isTrue();
        return parse(res.getBody());
    }

    private JsonNode get(String token, String path) {
        ResponseEntity<String> res = exchange(token, HttpMethod.GET, path, null);
        assertThat(res.getStatusCode().is2xxSuccessful())
            .as("GET %s -> %s : %s", path, res.getStatusCode(), res.getBody()).isTrue();
        return parse(res.getBody());
    }

    private JsonNode parse(String body) {
        try {
            return body == null || body.isBlank()
                ? objectMapper.createObjectNode() : objectMapper.readTree(body);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private Account signup(String username, String email) {
        String body = """
            {"username":"%s","nickname":"%s","email":"%s",
             "password":"password123","profileColor":"blue"}
            """.formatted(username, username, email);
        JsonNode j = post(null, "/api/v1/auth/signup", body);
        return new Account(j.get("accessToken").asText(), j.get("user").get("id").asText());
    }

    @Test
    void routineLifecycleAndStreak() {
        Account a = signup("rtnalice", "rtnalice@todly.dev");
        String groupId = post(a.token(), "/api/v1/groups",
            "{\"name\":\"Habits\",\"type\":\"group\",\"color\":\"blue\",\"icon\":\"home\"}")
            .get("id").asText();

        // Create a daily routine.
        JsonNode created = post(a.token(), "/api/v1/routines",
            "{\"groupId\":\"" + groupId + "\",\"title\":\"Morning meditation\","
                + "\"recurFreq\":\"daily\",\"recurRule\":{},\"timeOfDay\":\"06:30\"}");
        UUID routineId = UUID.fromString(created.get("id").asText());
        assertThat(created.get("isActive").asBoolean()).isTrue();
        assertThat(created.get("streak").get("current").asInt()).isZero();

        // Force nextRunAt into the past so it is due.
        Routine r = routineRepository.findById(routineId).orElseThrow();
        r.setNextRunAt(java.time.OffsetDateTime.now().minusMinutes(5));
        routineRepository.save(r);

        // materializeDue creates today's instance with routine_id + dueDate today.
        int created1 = routineService.materializeDue(Instant.now());
        assertThat(created1).isEqualTo(1);
        List<Task> instances = taskRepository.findGroupTasks(UUID.fromString(groupId));
        assertThat(instances).hasSize(1);
        Task instance = instances.get(0);
        assertThat(instance.getRoutineId()).isEqualTo(routineId);
        assertThat(instance.getDueDate()).isEqualTo(LocalDate.now());

        // Running again does NOT duplicate the same day's instance.
        int created2 = routineService.materializeDue(Instant.now());
        assertThat(created2).isZero();
        assertThat(taskRepository.findGroupTasks(UUID.fromString(groupId))).hasSize(1);

        // nextRunAt was advanced into the future (no longer due).
        Routine after = routineRepository.findById(routineId).orElseThrow();
        assertThat(after.getNextRunAt()).isAfter(java.time.OffsetDateTime.now());

        // POST complete -> routine_logs row + streak current=1.
        JsonNode completeRes = post(a.token(), "/api/v1/routines/" + routineId + "/complete", "");
        assertThat(completeRes.get("todayDone").asBoolean()).isTrue();
        assertThat(completeRes.get("streak").get("current").asInt()).isEqualTo(1);
        assertThat(logRepository.findByRoutineIdAndUserIdAndDoneOn(
            routineId, UUID.fromString(a.userId()), LocalDate.now())).isPresent();

        // Simulate two consecutive prior days by inserting done logs directly,
        // then recompute via another complete (idempotent today) -> current grows.
        insertDoneLog(routineId, UUID.fromString(a.userId()), LocalDate.now().minusDays(1));
        insertDoneLog(routineId, UUID.fromString(a.userId()), LocalDate.now().minusDays(2));
        JsonNode complete2 = post(a.token(), "/api/v1/routines/" + routineId + "/complete", "");
        assertThat(complete2.get("streak").get("current").asInt()).isEqualTo(3);
        assertThat(streakRepository.findById(routineId).orElseThrow().getBestStreak())
            .isGreaterThanOrEqualTo(3);

        // GET /routines reflects todayDone + streak.
        JsonNode list = get(a.token(), "/api/v1/routines");
        assertThat(list.isArray()).isTrue();
        JsonNode mine = list.get(0);
        assertThat(mine.get("todayDone").asBoolean()).isTrue();
        assertThat(mine.get("streak").get("current").asInt()).isEqualTo(3);
        assertThat(mine.get("todayTaskId").asText()).isEqualTo(instance.getId().toString());

        // Toggle inactive -> not materialized even when due.
        post(a.token(), "/api/v1/routines/" + routineId + "/toggle", "");
        Routine toggled = routineRepository.findById(routineId).orElseThrow();
        assertThat(toggled.isActive()).isFalse();
        toggled.setNextRunAt(java.time.OffsetDateTime.now().minusMinutes(5));
        routineRepository.save(toggled);
        int created3 = routineService.materializeDue(Instant.now());
        assertThat(created3).isZero();
    }

    private void insertDoneLog(UUID routineId, UUID userId, LocalDate day) {
        RoutineLog l = new RoutineLog();
        l.setRoutineId(routineId);
        l.setUserId(userId);
        l.setDoneOn(day);
        l.setSkipped(false);
        logRepository.save(l);
    }
}
