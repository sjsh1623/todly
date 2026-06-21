package com.todly.task;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PHASE 9 task-detail proof (SCR-12) against real PostgreSQL 16 + Redis.
 * Covers: detail comments/photos/subtasks/consistency, comment + notification
 * (respecting pushComment), author delete, non-member 403, task photo upload +
 * member/non-member photo authz.
 */
@Testcontainers
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = {
        "spring.flyway.enabled=true",
        "spring.jpa.hibernate.ddl-auto=validate"
    })
class TaskDetailTest {

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

    private HttpHeaders bearer(String token) {
        HttpHeaders h = new HttpHeaders();
        h.setBearerAuth(token);
        return h;
    }

    // The default TestRestTemplate uses HttpURLConnection which rejects PATCH; use
    // a RestTemplate backed by the JDK HttpClient (java.net.http) which supports it.
    // A no-op error handler keeps 4xx/5xx as a returned status (we assert on them).
    private final org.springframework.web.client.RestTemplate patchCapable = buildPatchCapable();

    private static org.springframework.web.client.RestTemplate buildPatchCapable() {
        org.springframework.web.client.RestTemplate t =
            new org.springframework.web.client.RestTemplate(
                new org.springframework.http.client.JdkClientHttpRequestFactory());
        t.setErrorHandler(new org.springframework.web.client.ResponseErrorHandler() {
            @Override
            public boolean hasError(org.springframework.http.client.ClientHttpResponse response) {
                return false;
            }

            @Override
            public void handleError(org.springframework.http.client.ClientHttpResponse response) {
            }
        });
        return t;
    }

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

    private long unreadCommentCount(Account acct) {
        JsonNode feed = get(acct.token(), "/api/v1/me/notifications");
        long count = 0;
        for (JsonNode n : feed.get("items")) {
            if ("comment".equals(n.get("type").asText())) {
                count++;
            }
        }
        return count;
    }

    @Test
    void taskDetailCommentsPhotosAndAuthz() throws Exception {
        Account a = signup("detalice", "detalice@todly.dev");
        Account b = signup("detbob", "detbob@todly.dev");      // member + assignee
        Account c = signup("detcarol", "detcarol@todly.dev");  // non-member

        String groupId = post(a.token(), "/api/v1/groups",
            "{\"name\":\"Trip\",\"type\":\"group\",\"color\":\"blue\",\"icon\":\"home\"}")
            .get("id").asText();
        String code = post(a.token(), "/api/v1/groups/" + groupId + "/invitations", "{}")
            .get("code").asText();
        post(b.token(), "/api/v1/invitations/" + code + "/accept", "{}");

        String taskId = post(a.token(), "/api/v1/tasks",
            "{\"groupId\":\"" + groupId + "\",\"title\":\"Pack bags\"}").get("id").asText();
        // assign B
        post(a.token(), "/api/v1/tasks/" + taskId + "/assignees",
            "{\"userId\":\"" + b.userId() + "\"}");
        // a subtask
        post(a.token(), "/api/v1/tasks/" + taskId + "/subtasks", "{\"title\":\"socks\"}");

        // Detail includes comments/photos/subtasks/consistency (empty/0 initially).
        JsonNode detail0 = get(a.token(), "/api/v1/tasks/" + taskId);
        assertThat(detail0.get("comments").isArray()).isTrue();
        assertThat(detail0.get("comments").size()).isZero();
        assertThat(detail0.get("photos").isArray()).isTrue();
        assertThat(detail0.get("photos").size()).isZero();
        assertThat(detail0.get("subtasks").size()).isEqualTo(1);
        assertThat(detail0.get("consistency").get("weeks").asInt()).isZero();

        // A comments -> 201, comment appears, B (assignee) gets a comment notification.
        long bBefore = unreadCommentCount(b);
        JsonNode comment = post(a.token(), "/api/v1/tasks/" + taskId + "/comments",
            "{\"body\":\"가방 다 쌌나요?\"}");
        String commentId = comment.get("id").asText();
        assertThat(comment.get("author").get("userId").asText()).isEqualTo(a.userId());
        assertThat(comment.get("author").get("nickname").asText()).isEqualTo("detalice");
        assertThat(comment.get("body").asText()).isEqualTo("가방 다 쌌나요?");

        JsonNode detail1 = get(a.token(), "/api/v1/tasks/" + taskId);
        assertThat(detail1.get("comments").size()).isEqualTo(1);
        assertThat(detail1.get("comments").get(0).get("body").asText()).isEqualTo("가방 다 쌌나요?");

        // B received a comment notification (pushComment default true).
        assertThat(unreadCommentCount(b)).isEqualTo(bBefore + 1);

        // The commenter (A) is NOT notified about their own comment.
        assertThat(unreadCommentCount(a)).isZero();

        // Disable B's pushComment -> a new comment does NOT notify B.
        ResponseEntity<String> patch = exchange(b.token(), HttpMethod.PATCH,
            "/api/v1/me/notification-settings", "{\"pushComment\":false}");
        assertThat(patch.getStatusCode().is2xxSuccessful()).isTrue();
        long bMid = unreadCommentCount(b);
        post(a.token(), "/api/v1/tasks/" + taskId + "/comments", "{\"body\":\"두 번째 댓글\"}");
        assertThat(unreadCommentCount(b)).isEqualTo(bMid); // suppressed

        // Author can delete own comment (soft delete) -> drops out of detail.
        ResponseEntity<String> del = exchange(a.token(), HttpMethod.DELETE,
            "/api/v1/comments/" + commentId, null);
        assertThat(del.getStatusCode()).isEqualTo(HttpStatus.NO_CONTENT);
        JsonNode detail2 = get(a.token(), "/api/v1/tasks/" + taskId);
        assertThat(detail2.get("comments").size()).isEqualTo(1); // only the 2nd remains

        // Non-member C: 403 on detail and on commenting.
        ResponseEntity<String> cView = exchange(c.token(), HttpMethod.GET,
            "/api/v1/tasks/" + taskId, null);
        assertThat(cView.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
        ResponseEntity<String> cComment = exchange(c.token(), HttpMethod.POST,
            "/api/v1/tasks/" + taskId + "/comments", "{\"body\":\"sneaky\"}");
        assertThat(cComment.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);

        // --- task photo upload (multipart) ---
        byte[] png = tinyPng();
        HttpHeaders mh = new HttpHeaders();
        mh.setContentType(MediaType.MULTIPART_FORM_DATA);
        mh.setBearerAuth(a.token());
        MultiValueMap<String, Object> form = new LinkedMultiValueMap<>();
        form.add("file", new ByteArrayResource(png) {
            @Override
            public String getFilename() {
                return "bag.png";
            }
        });
        ResponseEntity<String> photoRes = rest.exchange(
            "http://localhost:" + port + "/api/v1/tasks/" + taskId + "/photos",
            HttpMethod.POST, new HttpEntity<>(form, mh), String.class);
        assertThat(photoRes.getStatusCode().value())
            .as("photo upload -> %s : %s", photoRes.getStatusCode(), photoRes.getBody())
            .isEqualTo(201);
        JsonNode photo = parse(photoRes.getBody());
        String photoId = photo.get("id").asText();
        assertThat(photo.get("url").asText()).isEqualTo("/api/v1/photos/" + photoId);
        assertThat(photo.get("uploaderId").asText()).isEqualTo(a.userId());

        // Photo appears in task detail.
        JsonNode detail3 = get(a.token(), "/api/v1/tasks/" + taskId);
        assertThat(detail3.get("photos").size()).isEqualTo(1);
        assertThat(detail3.get("photos").get(0).get("id").asText()).isEqualTo(photoId);

        // GET /photos/{id} -> 200 for member B, thumb too.
        ResponseEntity<byte[]> bBytes = rest.exchange(
            "http://localhost:" + port + "/api/v1/photos/" + photoId,
            HttpMethod.GET, new HttpEntity<>(bearer(b.token())), byte[].class);
        assertThat(bBytes.getStatusCode().value()).isEqualTo(200);
        assertThat(bBytes.getBody()).isNotNull();
        assertThat(bBytes.getBody().length).isGreaterThan(0);
        ResponseEntity<byte[]> bThumb = rest.exchange(
            "http://localhost:" + port + "/api/v1/photos/" + photoId + "/thumb",
            HttpMethod.GET, new HttpEntity<>(bearer(b.token())), byte[].class);
        assertThat(bThumb.getStatusCode().value()).isEqualTo(200);

        // GET /photos/{id} -> 403 for non-member C.
        ResponseEntity<String> cPhoto = exchange(c.token(), HttpMethod.GET,
            "/api/v1/photos/" + photoId, null);
        assertThat(cPhoto.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
    }
}
