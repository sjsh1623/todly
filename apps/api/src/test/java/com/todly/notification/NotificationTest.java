package com.todly.notification;

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
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.lang.reflect.Type;
import java.time.LocalDate;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PHASE 7 notification proof against real PostgreSQL 16 + Redis (Testcontainers).
 *
 * <p>Asserts: assigning a task to B notifies B (persisted + realtime on the
 * personal /user/queue/notifications queue + unreadCount), mark-read clears the
 * count, pushLive=false suppresses a live_started notification, and scanDue
 * creates due_soon/overdue exactly once (deduped on a second run).
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
    })
class NotificationTest {

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
    NotificationService notificationService;

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
    static void stop() {
        if (stompClient != null) {
            stompClient.stop();
        }
    }

    private record Account(String token, String userId) {}

    private HttpHeaders json(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setContentType(MediaType.APPLICATION_JSON);
        if (token != null) {
            h.setBearerAuth(token);
        }
        return h;
    }

    // The default TestRestTemplate uses HttpURLConnection which rejects PATCH; use
    // a RestTemplate backed by the JDK HttpClient (java.net.http) which supports it.
    private final org.springframework.web.client.RestTemplate patchCapable =
        new org.springframework.web.client.RestTemplate(
            new org.springframework.http.client.JdkClientHttpRequestFactory());

    private ResponseEntity<String> exchange(String token, HttpMethod method, String path, String body) {
        return patchCapable.exchange("http://localhost:" + port + path, method,
            new HttpEntity<>(body, json(token)), String.class);
    }

    private JsonNode post(String token, String path, String body) {
        ResponseEntity<String> res = exchange(token, HttpMethod.POST, path, body);
        assertThat(res.getStatusCode().is2xxSuccessful())
            .as("POST %s -> %s : %s", path, res.getStatusCode(), res.getBody()).isTrue();
        return parse(res.getBody());
    }

    private JsonNode patch(String token, String path, String body) {
        ResponseEntity<String> res = exchange(token, HttpMethod.PATCH, path, body);
        assertThat(res.getStatusCode().is2xxSuccessful())
            .as("PATCH %s -> %s : %s", path, res.getStatusCode(), res.getBody()).isTrue();
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

    private StompSession connect(String token) throws Exception {
        StompHeaders connectHeaders = new StompHeaders();
        connectHeaders.add("Authorization", "Bearer " + token);
        String url = "ws://localhost:" + port + "/ws-native";
        return stompClient()
            .connectAsync(url, new WebSocketHttpHeaders(), connectHeaders,
                new StompSessionHandlerAdapter() {})
            .get(5, TimeUnit.SECONDS);
    }

    private BlockingQueue<JsonNode> subscribe(StompSession session, String dest) {
        BlockingQueue<JsonNode> queue = new LinkedBlockingDeque<>();
        session.subscribe(dest, new StompFrameHandler() {
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

    @Test
    void assignNotifiesRealtimeAndPersistsAndSettingsAndDueScan() throws Exception {
        Account a = signup("notalice", "notalice@todly.dev");
        Account b = signup("notbob", "notbob@todly.dev");

        String groupId = post(a.token(), "/api/v1/groups",
            "{\"name\":\"Proj\",\"type\":\"group\",\"color\":\"blue\",\"icon\":\"home\"}")
            .get("id").asText();
        String code = post(a.token(), "/api/v1/groups/" + groupId + "/invitations", "{}")
            .get("code").asText();
        post(b.token(), "/api/v1/invitations/" + code + "/accept", "{}");

        // B subscribes to its personal notification queue.
        StompSession sessionB = connect(b.token());
        BlockingQueue<JsonNode> queueB = subscribe(sessionB, "/user/queue/notifications");
        Thread.sleep(300);

        // A creates a task and assigns it to B -> B is notified (realtime + persisted).
        String taskId = post(a.token(), "/api/v1/tasks",
            "{\"groupId\":\"" + groupId + "\",\"title\":\"Write report\"}").get("id").asText();
        post(a.token(), "/api/v1/tasks/" + taskId + "/assignees",
            "{\"userId\":\"" + b.userId() + "\"}");

        JsonNode evt = awaitType(queueB, "notification.created", 3);
        assertThat(evt).as("notification.created not received by B").isNotNull();
        assertThat(evt.path("payload").path("type").asText()).isEqualTo("assigned");

        // Persisted + unreadCount == 1.
        JsonNode feed = get(b.token(), "/api/v1/me/notifications");
        assertThat(feed.get("unreadCount").asLong()).isEqualTo(1);
        String notifId = feed.get("items").get(0).get("id").asText();
        assertThat(feed.get("items").get(0).get("type").asText()).isEqualTo("assigned");

        // Mark read -> unreadCount 0.
        ResponseEntity<String> read = exchange(b.token(), HttpMethod.POST,
            "/api/v1/me/notifications/" + notifId + "/read", null);
        assertThat(read.getStatusCode().value()).isEqualTo(204);
        assertThat(get(b.token(), "/api/v1/me/notifications").get("unreadCount").asLong()).isZero();

        // Settings: B disables pushLive, then A starts a live -> B gets NO live_started.
        patch(b.token(), "/api/v1/me/notification-settings", "{\"pushLive\":false}");
        long beforeLive = get(b.token(), "/api/v1/me/notifications").get("unreadCount").asLong();
        post(a.token(), "/api/v1/tasks/" + taskId + "/live/start", "");
        Thread.sleep(500);
        JsonNode afterLive = get(b.token(), "/api/v1/me/notifications");
        // No new live_started notification (count unchanged) and none of type live_started.
        boolean anyLive = false;
        for (JsonNode it : afterLive.get("items")) {
            if ("live_started".equals(it.get("type").asText())) {
                anyLive = true;
            }
        }
        assertThat(anyLive).as("live_started should be suppressed by pushLive=false").isFalse();
        assertThat(afterLive.get("unreadCount").asLong()).isEqualTo(beforeLive);

        // Due/overdue scan: one task due today, one overdue, both assigned to B.
        LocalDate today = LocalDate.now();
        String dueTodayId = post(a.token(), "/api/v1/tasks",
            "{\"groupId\":\"" + groupId + "\",\"title\":\"Due today\",\"dueDate\":\""
                + today + "\"}").get("id").asText();
        String overdueId = post(a.token(), "/api/v1/tasks",
            "{\"groupId\":\"" + groupId + "\",\"title\":\"Overdue\",\"dueDate\":\""
                + today.minusDays(2) + "\"}").get("id").asText();
        post(a.token(), "/api/v1/tasks/" + dueTodayId + "/assignees",
            "{\"userId\":\"" + b.userId() + "\"}");
        post(a.token(), "/api/v1/tasks/" + overdueId + "/assignees",
            "{\"userId\":\"" + b.userId() + "\"}");

        int created1 = notificationService.scanDue(today);
        assertThat(created1).isEqualTo(2); // one due_soon + one overdue

        // Second run dedupes (no new notifications).
        int created2 = notificationService.scanDue(today);
        assertThat(created2).isZero();

        JsonNode dueFeed = get(b.token(), "/api/v1/me/notifications?limit=50");
        boolean hasDueSoon = false;
        boolean hasOverdue = false;
        for (JsonNode it : dueFeed.get("items")) {
            if ("due_soon".equals(it.get("type").asText())) {
                hasDueSoon = true;
            }
            if ("overdue".equals(it.get("type").asText())) {
                hasOverdue = true;
            }
        }
        assertThat(hasDueSoon).isTrue();
        assertThat(hasOverdue).isTrue();

        sessionB.disconnect();
    }
}
