package com.todly.gamification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PHASE 9 gamification proof against real PostgreSQL 16 + Redis (Testcontainers).
 *
 * <p>Asserts the documented scoring formula end-to-end: completing tasks bumps
 * the heatmap + yearlyCount + lifeScore + streak; reopening undoes it; routine
 * completion bumps routineScore and shows in the routine consistency grass.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
    })
class StatsTest {

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

    private String createTask(Account a, String groupId, String title) {
        return post(a.token(), "/api/v1/tasks",
            "{\"groupId\":\"" + groupId + "\",\"title\":\"" + title + "\"}").get("id").asText();
    }

    @Test
    void statsHeatmapAndRoutineScore() {
        Account a = signup("statalice", "statalice@todly.dev");
        String groupId = post(a.token(), "/api/v1/groups",
            "{\"name\":\"Habits\",\"type\":\"group\",\"color\":\"blue\",\"icon\":\"home\"}")
            .get("id").asText();

        // 5 tasks, all self-assigned so completionRate has a denominator.
        String[] taskIds = new String[5];
        for (int i = 0; i < 5; i++) {
            taskIds[i] = createTask(a, groupId, "Task " + i);
            post(a.token(), "/api/v1/tasks/" + taskIds[i] + "/assignees",
                "{\"userId\":\"" + a.userId() + "\"}");
        }

        // Complete 4 of 5.
        for (int i = 0; i < 4; i++) {
            post(a.token(), "/api/v1/tasks/" + taskIds[i] + "/complete", "");
        }

        // GET /me/stats: completionRate 80 (4/5), yearlyCount 4, streak 1, lifeScore > 0.
        JsonNode stats = get(a.token(), "/api/v1/me/stats");
        assertThat(stats.get("completionRate").asInt()).isEqualTo(80);
        assertThat(stats.get("yearlyCount").asInt()).isEqualTo(4);
        assertThat(stats.get("currentStreak").asInt()).isEqualTo(1);
        assertThat(stats.get("bestStreak").asInt()).isGreaterThanOrEqualTo(1);
        assertThat(stats.get("lifeScore").asInt()).isEqualTo(40); // 4 tasks * 10
        assertThat(stats.get("groupCount").asLong()).isEqualTo(1);
        assertThat(stats.get("rules").get("lifeScore").asText()).isNotBlank();
        assertThat(stats.get("rules").get("routineScore").asText()).isNotBlank();

        // GET /me/heatmap: 16 weeks (112 days), today has count 4 and level > 0.
        JsonNode heatmap = get(a.token(), "/api/v1/me/heatmap?weeks=16");
        assertThat(heatmap.get("days").size()).isEqualTo(16 * 7);
        JsonNode last = heatmap.get("days").get(heatmap.get("days").size() - 1);
        assertThat(last.get("day").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(last.get("count").asInt()).isEqualTo(4);
        assertThat(last.get("level").asInt()).isGreaterThan(0);

        // Reopen one -> yearlyCount 3, completionRate 60, lifeScore 30.
        post(a.token(), "/api/v1/tasks/" + taskIds[0] + "/reopen", "");
        JsonNode after = get(a.token(), "/api/v1/me/stats");
        assertThat(after.get("yearlyCount").asInt()).isEqualTo(3);
        assertThat(after.get("completionRate").asInt()).isEqualTo(60);
        assertThat(after.get("lifeScore").asInt()).isEqualTo(30);
        JsonNode heatmap2 = get(a.token(), "/api/v1/me/heatmap?weeks=16");
        JsonNode today2 = heatmap2.get("days").get(heatmap2.get("days").size() - 1);
        assertThat(today2.get("count").asInt()).isEqualTo(3);

        // Recent activity: my own actions, completions present.
        JsonNode recent = get(a.token(), "/api/v1/me/recent-activity?limit=10");
        assertThat(recent.isArray()).isTrue();
        assertThat(recent.size()).isGreaterThan(0);

        // --- routine completion bumps routineScore + grass ---
        String routineId = post(a.token(), "/api/v1/routines",
            "{\"groupId\":\"" + groupId + "\",\"title\":\"Morning run\","
                + "\"recurFreq\":\"daily\",\"recurRule\":{},\"timeOfDay\":\"06:30\"}")
            .get("id").asText();
        JsonNode beforeRoutine = get(a.token(), "/api/v1/me/stats");
        int routineScoreBefore = beforeRoutine.get("routineScore").asInt();

        post(a.token(), "/api/v1/routines/" + routineId + "/complete", "");

        JsonNode afterRoutine = get(a.token(), "/api/v1/me/stats");
        // routineScore jumps by at least 15 (one completion) + streak bonus.
        assertThat(afterRoutine.get("routineScore").asInt())
            .isGreaterThanOrEqualTo(routineScoreBefore + 15);
        // The routine completion also bumped today's grass (3 tasks + 1 routine = 4).
        assertThat(afterRoutine.get("yearlyCount").asInt()).isEqualTo(4);

        // Routine consistency: today's done day visible in the grass.
        JsonNode consistency = get(a.token(), "/api/v1/routines/consistency?weeks=16");
        assertThat(consistency.isArray()).isTrue();
        JsonNode rc = consistency.get(0);
        assertThat(rc.get("id").asText()).isEqualTo(routineId);
        assertThat(rc.get("streak").get("current").asInt()).isEqualTo(1);
        assertThat(rc.get("heatmap").size()).isEqualTo(16 * 7);
        JsonNode lastDay = rc.get("heatmap").get(rc.get("heatmap").size() - 1);
        assertThat(lastDay.get("day").asText()).isEqualTo(LocalDate.now().toString());
        assertThat(lastDay.get("done").asBoolean()).isTrue();

        // Per-routine heatmap endpoint returns the same shape.
        JsonNode single = get(a.token(), "/api/v1/routines/" + routineId + "/heatmap?weeks=16");
        assertThat(single.get("id").asText()).isEqualTo(routineId);
        assertThat(single.get("heatmap").size()).isEqualTo(16 * 7);
    }
}
