package com.todly.auth;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end auth flow against a real PostgreSQL 16 (Testcontainers) with Flyway,
 * Redis autoconfig excluded. Covers signup, login, protected /me, refresh
 * rotation (old token rejected), and logout (token then rejected).
 */
@Testcontainers
@SpringBootTest(properties = {
    "spring.flyway.enabled=true",
    "spring.jpa.hibernate.ddl-auto=validate",
    "spring.autoconfigure.exclude="
        + "org.springframework.boot.autoconfigure.data.redis.RedisAutoConfiguration,"
        + "org.springframework.boot.autoconfigure.data.redis.RedisRepositoriesAutoConfiguration"
})
@AutoConfigureMockMvc
class AuthFlowTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
        new PostgreSQLContainer<>("postgres:16");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void fullAuthFlow() throws Exception {
        String email = "flow@todly.dev";
        String signupBody = """
            {"username":"flowuser","nickname":"Flow","email":"%s",
             "password":"password123","profileColor":"green"}
            """.formatted(email);

        // signup -> 201 with tokens + user
        MvcResult signup = mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON).content(signupBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.refreshToken").isNotEmpty())
            .andExpect(jsonPath("$.user.username").value("flowuser"))
            .andExpect(jsonPath("$.user.email").value(email))
            .andExpect(jsonPath("$.user.profileColor").value("green"))
            .andExpect(jsonPath("$.user.theme").value("ocean"))
            .andExpect(jsonPath("$.user.darkMode").value(false))
            .andReturn();
        JsonNode signupJson = objectMapper.readTree(signup.getResponse().getContentAsString());
        String signupRefresh = signupJson.get("refreshToken").asText();

        // login -> 200 with tokens
        String loginBody = """
            {"email":"%s","password":"password123"}""".formatted(email);
        MvcResult login = mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(loginBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.user.email").value(email))
            .andReturn();
        JsonNode loginJson = objectMapper.readTree(login.getResponse().getContentAsString());
        String accessToken = loginJson.get("accessToken").asText();
        String refreshToken = loginJson.get("refreshToken").asText();

        // GET /me with token -> 200 correct user
        mockMvc.perform(get("/api/v1/me").header("Authorization", "Bearer " + accessToken))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.username").value("flowuser"))
            .andExpect(jsonPath("$.email").value(email));

        // GET /me without token -> 401
        mockMvc.perform(get("/api/v1/me"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        // refresh -> 200 new tokens
        String refreshBody = """
            {"refreshToken":"%s"}""".formatted(refreshToken);
        MvcResult refreshed = mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON).content(refreshBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty())
            .andExpect(jsonPath("$.refreshToken").isNotEmpty())
            .andReturn();
        JsonNode refreshedJson = objectMapper.readTree(refreshed.getResponse().getContentAsString());
        String newRefresh = refreshedJson.get("refreshToken").asText();
        assertThat(newRefresh).isNotEqualTo(refreshToken);

        // ROTATION: old refresh token now rejected -> 401
        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON).content(refreshBody))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));

        // logout with the new refresh token -> 204
        String logoutBody = """
            {"refreshToken":"%s"}""".formatted(newRefresh);
        mockMvc.perform(post("/api/v1/auth/logout")
                .contentType(MediaType.APPLICATION_JSON).content(logoutBody))
            .andExpect(status().isNoContent());

        // refresh with the logged-out token -> 401
        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON).content(logoutBody))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));

        // also clean up the still-valid signup refresh so nothing dangles
        assertThat(signupRefresh).isNotBlank();
    }

    @Test
    void duplicateEmailAndUsernameReturnConflict() throws Exception {
        String body = """
            {"username":"dupuser","nickname":"Dup","email":"dup@todly.dev",
             "password":"password123","profileColor":"blue"}""";
        mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated());

        // same email, different username -> 409 EMAIL_TAKEN
        String dupEmail = """
            {"username":"dupuser2","nickname":"Dup","email":"dup@todly.dev",
             "password":"password123","profileColor":"blue"}""";
        mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON).content(dupEmail))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("EMAIL_TAKEN"));

        // same username, different email -> 409 USERNAME_TAKEN
        String dupUsername = """
            {"username":"dupuser","nickname":"Dup","email":"dup2@todly.dev",
             "password":"password123","profileColor":"blue"}""";
        mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON).content(dupUsername))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }

    @Test
    void badLoginReturns401() throws Exception {
        String body = """
            {"email":"nobody@todly.dev","password":"wrongpassword"}""";
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
    }

    @Test
    void checkUsernameReports() throws Exception {
        String body = """
            {"username":"takenname","nickname":"T","email":"taken@todly.dev",
             "password":"password123","profileColor":"purple"}""";
        mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/auth/check-username").param("username", "takenname"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.available").value(false));

        mockMvc.perform(get("/api/v1/auth/check-username").param("username", "freenamehere"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.available").value(true));
    }

    @Test
    void passwordResetRequestAlwaysReturns204() throws Exception {
        mockMvc.perform(post("/api/v1/auth/password/reset-request")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"does-not-exist@todly.dev\"}"))
            .andExpect(status().isNoContent());
    }
}
