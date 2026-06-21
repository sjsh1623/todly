package com.todly.account;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * PHASE 10 end-to-end account/settings flow against a real PostgreSQL 16
 * (Testcontainers), Flyway, Redis autoconfig excluded, real Bearer auth.
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
class AccountTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16");

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

    private record Account(String token, String userId) {}

    private Account signup(String username, String email) throws Exception {
        String body = """
            {"username":"%s","nickname":"%s","email":"%s",
             "password":"password123","profileColor":"blue"}
            """.formatted(username, username, email);
        MvcResult res = mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andReturn();
        JsonNode json = objectMapper.readTree(res.getResponse().getContentAsString());
        return new Account(json.get("accessToken").asText(), json.get("user").get("id").asText());
    }

    private String auth(String token) {
        return "Bearer " + token;
    }

    @Test
    void updateProfileAndPreferences() throws Exception {
        Account a = signup("settingsuser", "settings@todly.dev");

        // PATCH /me theme + darkMode + nickname
        mockMvc.perform(patch("/api/v1/me")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"theme\":\"mint\",\"darkMode\":true,\"nickname\":\"새이름\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.theme").value("mint"))
            .andExpect(jsonPath("$.darkMode").value(true))
            .andExpect(jsonPath("$.nickname").value("새이름"));

        // GET /me reflects them + has the extended fields
        mockMvc.perform(get("/api/v1/me").header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.theme").value("mint"))
            .andExpect(jsonPath("$.darkMode").value(true))
            .andExpect(jsonPath("$.nickname").value("새이름"))
            .andExpect(jsonPath("$.language").value("ko"))
            .andExpect(jsonPath("$.email").value("settings@todly.dev"));

        // invalid theme -> 400 VALIDATION_ERROR
        mockMvc.perform(patch("/api/v1/me")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"theme\":\"neon\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void changePasswordFlow() throws Exception {
        String email = "pwd@todly.dev";
        Account a = signup("pwduser", email);

        // wrong current -> 401
        mockMvc.perform(post("/api/v1/me/password")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"nope\",\"newPassword\":\"newpassword123\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        // correct current + valid new -> 204
        mockMvc.perform(post("/api/v1/me/password")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"currentPassword\":\"password123\",\"newPassword\":\"newpassword123\"}"))
            .andExpect(status().isNoContent());

        // login with OLD password -> 401
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        // login with NEW password -> 200
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"newpassword123\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    @Test
    void connectedAccountsEmptyForEmailAccount() throws Exception {
        Account a = signup("noauthuser", "noauth@todly.dev");

        mockMvc.perform(get("/api/v1/me/connected-accounts")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$").isArray())
            .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void exportContainsProfileGroupsAndTasks() throws Exception {
        Account a = signup("exportuser", "export@todly.dev");

        // a group
        MvcResult g = mockMvc.perform(post("/api/v1/groups")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Household\",\"type\":\"group\",\"color\":\"blue\",\"icon\":\"home\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        String groupId = objectMapper.readTree(g.getResponse().getContentAsString()).get("id").asText();

        // a task in the group
        mockMvc.perform(post("/api/v1/tasks")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"groupId\":\"" + groupId + "\",\"title\":\"Buy milk\"}"))
            .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/me/export")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(header().string("Content-Disposition", "attachment; filename=\"todly-export.json\""))
            .andExpect(jsonPath("$.profile.email").value("export@todly.dev"))
            .andExpect(jsonPath("$.groups.length()").value(1))
            .andExpect(jsonPath("$.groups[0].groupName").value("Household"))
            .andExpect(jsonPath("$.createdTasks.length()").value(1))
            .andExpect(jsonPath("$.createdTasks[0].title").value("Buy milk"))
            .andExpect(jsonPath("$.stats").exists());
    }

    @Test
    void deleteAccountAnonymizesAndRevokesAccess() throws Exception {
        String email = "delete@todly.dev";
        Account a = signup("deleteuser", email);

        // wrong password -> 401
        mockMvc.perform(delete("/api/v1/me")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"wrong\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        // correct password -> 204
        mockMvc.perform(delete("/api/v1/me")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"password\":\"password123\"}"))
            .andExpect(status().isNoContent());

        // old access token no longer works (soft-deleted principal rejected) -> 401
        mockMvc.perform(get("/api/v1/me").header("Authorization", auth(a.token())))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        // login with the deleted account's credentials -> 401
        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"password123\"}"))
            .andExpect(status().isUnauthorized())
            .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));

        // the email is now free again (anonymized) -> can re-signup
        mockMvc.perform(post("/api/v1/auth/signup")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"deleteuser2\",\"nickname\":\"new\",\"email\":\"" + email
                    + "\",\"password\":\"password123\",\"profileColor\":\"green\"}"))
            .andExpect(status().isCreated());
    }

    @Test
    void supportContactReturns204() throws Exception {
        Account a = signup("supportuser", "support@todly.dev");

        mockMvc.perform(post("/api/v1/support/contact")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"subject\":\"문의\",\"body\":\"앱이 너무 좋아요\"}"))
            .andExpect(status().isNoContent());

        // empty subject -> 400
        mockMvc.perform(post("/api/v1/support/contact")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"subject\":\"\",\"body\":\"x\"}"))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        assertThat(a.userId()).isNotBlank();
    }
}
