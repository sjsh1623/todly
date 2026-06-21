package com.todly.room;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
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
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.socket.WebSocketHttpHeaders;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.messaging.WebSocketStompClient;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Type;
import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingDeque;
import java.util.concurrent.TimeUnit;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end live-room proof for PHASE 6: two STOMP clients over {@code /ws-native}
 * with JWT CONNECT auth against real PostgreSQL 16 + Redis (Testcontainers).
 *
 * <p>Asserts room create (host), join + participants fanout, message fanout
 * (REST and {@code /app/rooms/{id}/cheer}), photo upload + serve + fanout,
 * end + ROOM_ENDED, and non-member 403.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
    })
class LiveRoomStompTest {

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

    private ResponseEntity<String> exchange(String token, HttpMethod method, String path, String body) {
        return rest.exchange("http://localhost:" + port + path, method,
            new HttpEntity<>(body, json(token)), String.class);
    }

    private JsonNode post(String token, String path, String body) {
        ResponseEntity<String> res = exchange(token, HttpMethod.POST, path, body);
        assertThat(res.getStatusCode().is2xxSuccessful())
            .as("POST %s -> %s : %s", path, res.getStatusCode(), res.getBody())
            .isTrue();
        return parse(res.getBody());
    }

    private JsonNode get(String token, String path) {
        ResponseEntity<String> res = exchange(token, HttpMethod.GET, path, null);
        assertThat(res.getStatusCode().is2xxSuccessful())
            .as("GET %s -> %s : %s", path, res.getStatusCode(), res.getBody())
            .isTrue();
        return parse(res.getBody());
    }

    private JsonNode parse(String body) {
        try {
            return body == null || body.isBlank()
                ? objectMapper.createObjectNode()
                : objectMapper.readTree(body);
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
            .connectAsync(url, new WebSocketHttpHeaders(), connectHeaders,
                new StompSessionHandlerAdapter() {})
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

    private JsonNode awaitMessageFrom(BlockingQueue<JsonNode> queue, String senderId, long seconds)
            throws InterruptedException {
        long deadline = System.currentTimeMillis() + seconds * 1000;
        while (System.currentTimeMillis() < deadline) {
            JsonNode msg = queue.poll(deadline - System.currentTimeMillis(), TimeUnit.MILLISECONDS);
            if (msg == null) {
                break;
            }
            if ("room.message".equals(msg.path("type").asText())
                    && senderId.equals(msg.path("payload").path("senderId").asText())) {
                return msg;
            }
        }
        return null;
    }

    private byte[] tinyPng() throws Exception {
        BufferedImage img = new BufferedImage(8, 8, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.MAGENTA);
        g.fillRect(0, 0, 8, 8);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    // --- the test ---------------------------------------------------------

    @Test
    void liveRoomFanoutAcrossTwoClients() throws Exception {
        Account a = signup("roomalice", "roomalice@todly.dev");
        Account b = signup("roombob", "roombob@todly.dev");
        Account c = signup("roomcarol", "roomcarol@todly.dev"); // non-member

        // A creates a group + section + task; B joins via invite.
        String groupId = post(a.token(), "/api/v1/groups",
            "{\"name\":\"Run\",\"type\":\"group\",\"color\":\"blue\",\"icon\":\"home\"}")
            .get("id").asText();
        String sectionId = post(a.token(), "/api/v1/groups/" + groupId + "/sections",
            "{\"title\":\"Live\",\"position\":0}").get("id").asText();
        String taskId = post(a.token(), "/api/v1/tasks",
            "{\"groupId\":\"" + groupId + "\",\"sectionId\":\"" + sectionId
                + "\",\"title\":\"Morning run\"}").get("id").asText();
        String code = post(a.token(), "/api/v1/groups/" + groupId + "/invitations", "{}")
            .get("code").asText();
        post(b.token(), "/api/v1/invitations/" + code + "/accept", "{}");

        // A opens the live room (host).
        JsonNode room = post(a.token(), "/api/v1/live-rooms",
            "{\"taskId\":\"" + taskId + "\"}").get("room");
        String roomId = room.get("id").asText();
        assertThat(room.get("host").get("userId").asText()).isEqualTo(a.userId());
        assertThat(room.get("participantCount").asInt()).isEqualTo(1);

        // B sees the room.
        JsonNode bView = get(b.token(), "/api/v1/live-rooms/" + roomId);
        assertThat(bView.get("status").asText()).isEqualTo("live");
        assertThat(bView.get("title").asText()).isEqualTo("Morning run");

        // Both clients subscribe to the room topic.
        StompSession sessionA = connect(a.token());
        StompSession sessionB = connect(b.token());
        String topic = "/topic/rooms/" + roomId;
        BlockingQueue<JsonNode> queueA = subscribe(sessionA, topic);
        BlockingQueue<JsonNode> queueB = subscribe(sessionB, topic);
        Thread.sleep(300); // let subscriptions settle

        // B joins -> A receives room.joined + room.participants, count 2.
        long t0 = System.currentTimeMillis();
        JsonNode joined = post(b.token(), "/api/v1/live-rooms/" + roomId + "/join", "").get("room");
        assertThat(joined.get("participantCount").asInt()).isEqualTo(2);

        JsonNode joinEvt = awaitType(queueA, "room.joined", 2);
        long joinLatency = System.currentTimeMillis() - t0;
        assertThat(joinEvt).as("room.joined not received by A").isNotNull();
        assertThat(joinLatency).as("room.joined latency").isLessThan(2000L);
        assertThat(joinEvt.path("payload").path("user").path("userId").asText())
            .isEqualTo(b.userId());

        JsonNode parts = awaitType(queueA, "room.participants", 2);
        assertThat(parts).as("room.participants not received by A").isNotNull();
        assertThat(parts.path("payload").path("participantCount").asInt()).isEqualTo(2);

        // A sends a message via REST -> B receives room.message.
        long t1 = System.currentTimeMillis();
        post(a.token(), "/api/v1/live-rooms/" + roomId + "/messages",
            "{\"body\":\"마지막 바퀴 가자! 🏃\"}");
        JsonNode msg = awaitType(queueB, "room.message", 3);
        long msgLatency = System.currentTimeMillis() - t1;
        assertThat(msg).as("room.message (REST) not received by B").isNotNull();
        assertThat(msgLatency).as("room.message latency").isLessThan(2000L);
        assertThat(msg.path("payload").path("body").asText()).isEqualTo("마지막 바퀴 가자! 🏃");
        assertThat(msg.path("payload").path("senderId").asText()).isEqualTo(a.userId());

        // B cheers over STOMP /app/rooms/{id}/cheer -> A receives B's room.message.
        // (A also receives its own REST message above; match on B's senderId.)
        sessionB.send("/app/rooms/" + roomId + "/cheer",
            java.util.Map.of("emoji", "💙", "body", "둘 다 자랑스러워"));
        JsonNode cheer = awaitMessageFrom(queueA, b.userId(), 3);
        assertThat(cheer).as("room.message (cheer) from B not received by A").isNotNull();
        assertThat(cheer.path("payload").path("emoji").asText()).isEqualTo("💙");

        // A uploads a photo -> 201, B receives room.photo, GET returns bytes.
        long t2 = System.currentTimeMillis();
        byte[] png = tinyPng();
        HttpHeaders mh = new HttpHeaders();
        mh.setContentType(MediaType.MULTIPART_FORM_DATA);
        mh.setBearerAuth(a.token());
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("file", new ByteArrayResource(png) {
            @Override
            public String getFilename() {
                return "shot.png";
            }
        });
        ResponseEntity<String> photoRes = rest.exchange(
            "http://localhost:" + port + "/api/v1/live-rooms/" + roomId + "/photos",
            HttpMethod.POST, new HttpEntity<>(form, mh), String.class);
        assertThat(photoRes.getStatusCode().value())
            .as("photo upload -> %s : %s", photoRes.getStatusCode(), photoRes.getBody())
            .isEqualTo(201);
        JsonNode photo = parse(photoRes.getBody()).get("photo");
        String photoId = photo.get("id").asText();
        assertThat(photo.get("url").asText()).isEqualTo("/api/v1/photos/" + photoId);

        JsonNode photoEvt = awaitType(queueB, "room.photo", 3);
        long photoLatency = System.currentTimeMillis() - t2;
        assertThat(photoEvt).as("room.photo not received by B").isNotNull();
        assertThat(photoLatency).as("room.photo latency").isLessThan(3000L);
        assertThat(photoEvt.path("payload").path("uploaderId").asText()).isEqualTo(a.userId());

        // GET photo bytes (as member B).
        ResponseEntity<byte[]> bytesRes = rest.exchange(
            "http://localhost:" + port + "/api/v1/photos/" + photoId,
            HttpMethod.GET, new HttpEntity<>(bearer(b.token())), byte[].class);
        assertThat(bytesRes.getStatusCode().value()).isEqualTo(200);
        assertThat(bytesRes.getBody()).isNotNull();
        assertThat(bytesRes.getBody().length).isGreaterThan(0);
        // thumb too
        ResponseEntity<byte[]> thumbRes = rest.exchange(
            "http://localhost:" + port + "/api/v1/photos/" + photoId + "/thumb",
            HttpMethod.GET, new HttpEntity<>(bearer(b.token())), byte[].class);
        assertThat(thumbRes.getStatusCode().value()).isEqualTo(200);

        // Non-member C cannot view the photo or join/view the room -> 403.
        ResponseEntity<String> cPhoto = exchange(c.token(), HttpMethod.GET,
            "/api/v1/photos/" + photoId, null);
        assertThat(cPhoto.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        ResponseEntity<String> cView = exchange(c.token(), HttpMethod.GET,
            "/api/v1/live-rooms/" + roomId, null);
        assertThat(cView.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        ResponseEntity<String> cJoin = exchange(c.token(), HttpMethod.POST,
            "/api/v1/live-rooms/" + roomId + "/join", null);
        assertThat(cJoin.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        // Host A ends the room -> B receives room.ended; subsequent join -> 410.
        exchange(a.token(), HttpMethod.POST, "/api/v1/live-rooms/" + roomId + "/end", null);
        JsonNode endEvt = awaitType(queueB, "room.ended", 3);
        assertThat(endEvt).as("room.ended not received by B").isNotNull();
        assertThat(endEvt.path("payload").path("roomId").asText()).isEqualTo(roomId);

        ResponseEntity<String> rejoin = exchange(b.token(), HttpMethod.POST,
            "/api/v1/live-rooms/" + roomId + "/join", null);
        assertThat(rejoin.getStatusCode()).isEqualTo(HttpStatus.GONE);
        assertThat(parse(rejoin.getBody()).get("code").asText()).isEqualTo("ROOM_ENDED");

        sessionA.disconnect();
        sessionB.disconnect();
    }

    private HttpHeaders bearer(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }
}
