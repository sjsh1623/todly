package com.todly.activity;

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
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PHASE 7 activity feed proof against real PostgreSQL 16 + Redis (Testcontainers).
 *
 * <p>Performs a few feed-producing actions (member join, task complete, live
 * start) then asserts: the group feed returns them newest-first, cursor
 * pagination returns the next page with no overlap, and a non-member gets 403.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
    })
class ActivityFeedTest {

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

    @Test
    void feedNewestFirstWithCursorPaginationAndAuthz() {
        Account a = signup("actalice", "actalice@todly.dev");
        Account b = signup("actbob", "actbob@todly.dev");
        Account c = signup("actcarol", "actcarol@todly.dev"); // non-member

        String groupId = post(a.token(), "/api/v1/groups",
            "{\"name\":\"Team\",\"type\":\"group\",\"color\":\"blue\",\"icon\":\"home\"}")
            .get("id").asText();

        // Create several tasks (each writes task_created) and complete them, and
        // have B join (member_joined), then A starts a live session (live_started).
        List<String> taskIds = new ArrayList<>();
        for (int i = 0; i < 6; i++) {
            String tid = post(a.token(), "/api/v1/tasks",
                "{\"groupId\":\"" + groupId + "\",\"title\":\"Task " + i + "\"}").get("id").asText();
            taskIds.add(tid);
        }
        // B joins via invite -> member_joined activity.
        String code = post(a.token(), "/api/v1/groups/" + groupId + "/invitations", "{}")
            .get("code").asText();
        post(b.token(), "/api/v1/invitations/" + code + "/accept", "{}");

        // Complete a couple tasks -> task_completed activities.
        post(a.token(), "/api/v1/tasks/" + taskIds.get(0) + "/complete", "");
        post(a.token(), "/api/v1/tasks/" + taskIds.get(1) + "/complete", "");

        // A starts live on a task -> live_started activity.
        post(a.token(), "/api/v1/tasks/" + taskIds.get(2) + "/live/start", "");

        // --- group feed: newest first ---
        JsonNode page1 = get(a.token(), "/api/v1/groups/" + groupId + "/activities?limit=5");
        JsonNode items1 = page1.get("items");
        assertThat(items1.size()).isEqualTo(5);
        // Strictly non-increasing createdAt (newest first).
        for (int i = 1; i < items1.size(); i++) {
            String prev = items1.get(i - 1).get("createdAt").asText();
            String cur = items1.get(i).get("createdAt").asText();
            assertThat(prev.compareTo(cur)).isGreaterThanOrEqualTo(0);
        }
        // The most recent activities include live_started (last action).
        Set<String> typesPage1 = new HashSet<>();
        Set<String> idsPage1 = new HashSet<>();
        for (JsonNode it : items1) {
            typesPage1.add(it.get("type").asText());
            idsPage1.add(it.get("id").asText());
        }
        assertThat(typesPage1).contains("live_started");

        // --- cursor pagination: next page has no overlap ---
        String cursor = page1.get("nextCursor").asText();
        assertThat(cursor).isNotBlank();
        JsonNode page2 = get(a.token(),
            "/api/v1/groups/" + groupId + "/activities?limit=5&cursor=" + cursor);
        JsonNode items2 = page2.get("items");
        assertThat(items2.size()).isGreaterThan(0);
        for (JsonNode it : items2) {
            assertThat(idsPage1).doesNotContain(it.get("id").asText());
        }

        // The feed contains member_joined and task_completed somewhere across pages.
        Set<String> allTypes = new HashSet<>(typesPage1);
        for (JsonNode it : items2) {
            allTypes.add(it.get("type").asText());
        }
        assertThat(allTypes).contains("member_joined");
        assertThat(allTypes).contains("task_completed");
        assertThat(allTypes).contains("task_created");

        // --- merged feed across my groups works for B too ---
        JsonNode merged = get(b.token(), "/api/v1/activities?limit=50");
        assertThat(merged.get("items").size()).isGreaterThan(0);
        assertThat(merged.get("items").get(0).has("groupId")).isTrue();
        assertThat(merged.get("items").get(0).get("groupName").asText()).isEqualTo("Team");

        // --- non-member -> 403 on the group feed ---
        ResponseEntity<String> cView = exchange(c.token(), HttpMethod.GET,
            "/api/v1/groups/" + groupId + "/activities", null);
        assertThat(cView.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
