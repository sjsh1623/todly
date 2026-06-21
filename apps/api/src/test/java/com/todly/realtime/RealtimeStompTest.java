package com.todly.realtime;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
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
import org.springframework.lang.NonNull;
import org.springframework.messaging.converter.MappingJackson2MessageConverter;
import org.springframework.messaging.simp.stomp.StompFrameHandler;
import org.springframework.messaging.simp.stomp.StompHeaders;
import org.springframework.messaging.simp.stomp.StompSession;
import org.springframework.messaging.simp.stomp.StompSessionHandlerAdapter;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.lang.reflect.Type;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end realtime proof for PHASE 5: two STOMP clients over the raw
 * {@code /ws-native} endpoint with JWT CONNECT auth, against a real PostgreSQL 16
 * and a real Redis (both Testcontainers), Flyway on, full app context.
 *
 * <p>Asserts: presence shows onlineCount 2 with two subscribers; a REST
 * task-complete is fanned out to the other client as {@code task.completed} with
 * fresh progress; live start/stop arrive as {@code live.started}/{@code live.ended}.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
    })
class RealtimeStompTest {

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
        // Override the application.yml redis URL so it points at the container.
        registry.add("spring.data.redis.url", () ->
            "redis://" + REDIS.getHost() + ":" + REDIS.getMappedPort(6379));
    }

    @LocalServerPort
    int port;

    @Autowired
    TestRestTemplate rest;

    @Autowired
    ObjectMapper objectMapper;

    private static WebSocketStompClient stompClient;

    private WebSocketStompClient stompClient() {
        if (stompClient == null) {
            WebSocketStompClient client = new WebSocketStompClient(new StandardWebSocketClient());
            client.setMessageConverter(new MappingJackson2MessageConverter());
            stompClient = client;
        }
        return stompClient;
    }

    @AfterAll
    static void stopClient() {
        if (stompClient != null) {
            stompClient.stop();
        }
    }

    // --- REST helpers -----------------------------------------------------

    private record Account(String token, String userId) {}

    private HttpHeaders json(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            h.setBearerAuth(token);
        }
        return h;
    }

    private JsonNode post(String token, String path, String body) {
        ResponseEntity<String> res = rest.exchange(
            "http://localhost:" + port + path, HttpMethod.POST,
            new HttpEntity<>(body, json(token)), String.class);
        assertThat(res.getStatusCode().is2xxSuccessful())
            .as("POST %s -> %s : %s", path, res.getStatusCode(), res.getBody())
            .isTrue();
        try {
            return res.getBody() == null || res.getBody().isBlank()
                ? objectMapper.createObjectNode()
                : objectMapper.readTree(res.getBody());
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    private Account signup(String username, String email) {
        String body = """
            {"username":"%s","nickname":"%s","email":"%s",
             "password":"password123","profileColor":"blue"}
            """.formatted(username, username, email);
        JsonNode json = post(null, "/api/v1/auth/signup", body);
        return new Account(json.get("accessToken").asText(), json.get("user").get("id").asText());
    }

    private StompSession connect(String token) throws Exception {
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);
        String url = "ws://localhost:" + port + "/ws-native";
        return stompClient()
            .connectAsync(url, new org.springframework.web.socket.WebSocketHttpHeaders(),
                connectHeaders, new StompSessionHandlerAdapter() {})
            .get(5, TimeUnit.SECONDS);
    }

    private BlockingQueue<JsonNode> subscribe(StompSession session, String topic) {
        BlockingQueue<JsonNode> queue = new LinkedBlockingDeque<>();
        session.subscribe(topic, new StompFrameHandler() {
            @Override
            @NonNull
            public Type getPayloadType(@NonNull StompHeaders headers) {
                return JsonNode.class;
            }

            @Override
            public void handleFrame(@NonNull StompHeaders headers, Object payload) {
                queue.add((JsonNode) payload);
            }
        });
        return queue;
    }

    private JsonNode awaitType(BlockingQueue<JsonNode> queue, String type, long seconds)
            throws InterruptedException {
        long deadline = System.currentTimeMillis() + seconds * 1000;
        while (System.currentTimeMillis() < deadline) {
            JsonNode msg = queue.poll(deadline - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
            if (msg == null) {
                break;
            }
            if (type.equals(msg.path("type").asText())) {
                return msg;
            }
        }
        return null;
    }

    // --- the test ---------------------------------------------------------

    @Test
    void realtimeFanoutAcrossTwoClients() throws Exception {
        Account a = signup("realalice", "realalice@todly.dev");
        Account b = signup("realbob", "realbob@todly.dev");

        // A creates a group + section + task; B joins via invite.
        String groupId = post(a.token(), "/api/v1/groups",
            "{\"name\":\"Realtime\",\"type\":\"group\",\"color\":\"blue\",\"icon\":\"home\"}")
            .get("id").asText();
        String sectionId = post(a.token(), "/api/v1/groups/" + groupId + "/sections",
            "{\"title\":\"Live\",\"position\":0}").get("id").asText();
        String taskId = post(a.token(), "/api/v1/tasks",
            "{\"groupId\":\"" + groupId + "\",\"sectionId\":\"" + sectionId
                + "\",\"title\":\"Focus task\"}").get("id").asText();

        String code = post(a.token(), "/api/v1/groups/" + groupId + "/invitations", "{}")
            .get("code").asText();
        post(b.token(), "/api/v1/invitations/" + code + "/accept", "{}");

        // Two STOMP clients subscribe to the group topic.
        StompSession sessionA = connect(a.token());
        StompSession sessionB = connect(b.token());
        String topic = "/topic/groups/" + groupId;
        BlockingQueue<JsonNode> queueA = subscribe(sessionA, topic);
        BlockingQueue<JsonNode> queueB = subscribe(sessionB, topic);

        // Presence should reach onlineCount 2 within a couple seconds. Either
        // client may receive the final state; assert on B (subscribed last).
        JsonNode presence = null;
        long deadline = System.currentTimeMillis() + 4000;
        while (System.currentTimeMillis() < deadline) {
            JsonNode msg = awaitType(queueB, "presence.updated", 4);
            if (msg != null && msg.path("payload").path("onlineCount").asInt() >= 2) {
                presence = msg;
                break;
            }
            if (msg == null) {
                break;
            }
        }
        assertThat(presence)
            .as("presence.updated with onlineCount >= 2 not received in time")
            .isNotNull();
        assertThat(presence.path("payload").path("onlineCount").asInt()).isEqualTo(2);

        // A completes the task via REST; B must receive task.completed quickly.
        long t0 = System.currentTimeMillis();
        post(a.token(), "/api/v1/tasks/" + taskId + "/complete", "");
        JsonNode completed = awaitType(queueB, "task.completed", 3);
        long latency = System.currentTimeMillis() - t0;
        assertThat(completed)
            .as("task.completed not received within latency bound")
            .isNotNull();
        assertThat(latency).as("task.completed latency").isLessThan(2000L);
        assertThat(completed.path("payload").path("task").path("status").asText())
            .isEqualTo("done");
        assertThat(completed.path("payload").path("progress").path("done").asInt())
            .isEqualTo(1);
        assertThat(completed.path("payload").path("progress").path("percent").asInt())
            .isEqualTo(100);

        // Reopen so live can revert to todo cleanly.
        post(a.token(), "/api/v1/tasks/" + taskId + "/reopen", "");
        assertThat(awaitType(queueB, "task.reopened", 3)).isNotNull();

        // A starts a live session; B receives live.started ~1s.
        post(a.token(), "/api/v1/tasks/" + taskId + "/live/start", "");
        JsonNode started = awaitType(queueB, "live.started", 2);
        assertThat(started).as("live.started not received").isNotNull();
        assertThat(started.path("payload").path("session").path("taskId").asText())
            .isEqualTo(taskId);
        assertThat(started.path("payload").path("session").path("userId").asText())
            .isEqualTo(a.userId());
        assertThat(started.path("payload").path("session").path("status").asText())
            .isEqualTo("running");

        // A stops the live session; B receives live.ended.
        post(a.token(), "/api/v1/tasks/" + taskId + "/live/stop", "");
        JsonNode ended = awaitType(queueB, "live.ended", 2);
        assertThat(ended).as("live.ended not received").isNotNull();
        assertThat(ended.path("payload").path("taskId").asText()).isEqualTo(taskId);
        assertThat(ended.path("payload").path("userId").asText()).isEqualTo(a.userId());

        sessionA.disconnect();
        sessionB.disconnect();
    }
}
