package com.todly.group;

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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end group/member/invitation flow against a real PostgreSQL 16
 * (Testcontainers) with Flyway, Redis autoconfig excluded, real Bearer auth.
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
class GroupFlowTest {

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
    void fullGroupFlow() throws Exception {
        Account a = signup("alice", "alice@todly.dev");

        // A creates a group -> 201, owner
        String createBody = """
            {"name":"Trip 2026","type":"travel","color":"green","icon":"plane",
             "description":"summer"}""";
        MvcResult created = mockMvc.perform(post("/api/v1/groups")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON).content(createBody))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.name").value("Trip 2026"))
            .andExpect(jsonPath("$.type").value("travel"))
            .andExpect(jsonPath("$.role").value("owner"))
            .andExpect(jsonPath("$.ownerId").value(a.userId()))
            .andExpect(jsonPath("$.memberCount").value(1))
            .andExpect(jsonPath("$.progress.percent").value(0))
            .andExpect(jsonPath("$.progress.total").value(0))
            .andReturn();
        String groupId = objectMapper.readTree(created.getResponse().getContentAsString())
            .get("id").asText();

        // A GET /groups shows it, role owner
        mockMvc.perform(get("/api/v1/groups").header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(groupId))
            .andExpect(jsonPath("$[0].role").value("owner"))
            .andExpect(jsonPath("$[0].memberCount").value(1))
            .andExpect(jsonPath("$[0].members[0].userId").value(a.userId()));

        // --- validation: bad type rejected ---
        mockMvc.perform(post("/api/v1/groups")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"x\",\"type\":\"nope\",\"color\":\"blue\"}"))
            .andExpect(status().isBadRequest());

        // A creates an invitation -> 201, code + relative url
        MvcResult inviteRes = mockMvc.perform(post("/api/v1/groups/" + groupId + "/invitations")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.code").isNotEmpty())
            .andExpect(jsonPath("$.expiresAt").isNotEmpty())
            .andReturn();
        JsonNode inviteJson = objectMapper.readTree(inviteRes.getResponse().getContentAsString());
        String code = inviteJson.get("code").asText();
        assertThat(inviteJson.get("url").asText()).isEqualTo("/invite/" + code);
        assertThat(code.length()).isBetween(8, 10);

        // B signup -> preview -> accept -> member
        Account b = signup("bob", "bob@todly.dev");

        mockMvc.perform(get("/api/v1/invitations/" + code).header("Authorization", auth(b.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.group.id").value(groupId))
            .andExpect(jsonPath("$.group.name").value("Trip 2026"))
            .andExpect(jsonPath("$.status").value("pending"))
            .andExpect(jsonPath("$.expired").value(false));

        mockMvc.perform(post("/api/v1/invitations/" + code + "/accept")
                .header("Authorization", auth(b.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.groupId").value(groupId));

        // accept again -> 409 ALREADY_MEMBER
        mockMvc.perform(post("/api/v1/invitations/" + code + "/accept")
                .header("Authorization", auth(b.token())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ALREADY_MEMBER"));

        // B GET /groups shows it, role member
        mockMvc.perform(get("/api/v1/groups").header("Authorization", auth(b.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].id").value(groupId))
            .andExpect(jsonPath("$[0].role").value("member"))
            .andExpect(jsonPath("$[0].memberCount").value(2));

        // unknown code -> 404
        mockMvc.perform(get("/api/v1/invitations/doesnotexist").header("Authorization", auth(b.token())))
            .andExpect(status().isNotFound());

        // A PATCH B -> admin OK
        mockMvc.perform(patch("/api/v1/groups/" + groupId + "/members/" + b.userId())
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"admin\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("admin"));

        // B (admin) PATCH A (owner) -> 403
        mockMvc.perform(patch("/api/v1/groups/" + groupId + "/members/" + a.userId())
                .header("Authorization", auth(b.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"member\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // plain member create invitation -> 403
        Account c = signup("carol", "carol@todly.dev");
        mockMvc.perform(post("/api/v1/invitations/" + code + "/accept")
                .header("Authorization", auth(c.token())))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/groups/" + groupId + "/invitations")
                .header("Authorization", auth(c.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // non-member GET /groups/{id} -> 403
        Account d = signup("dave", "dave@todly.dev");
        mockMvc.perform(get("/api/v1/groups/" + groupId).header("Authorization", auth(d.token())))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        // DELETE group by non-owner (B is admin) -> 403
        mockMvc.perform(delete("/api/v1/groups/" + groupId).header("Authorization", auth(b.token())))
            .andExpect(status().isForbidden());

        // Owner DELETE self -> 409 OWNER_MUST_DELEGATE
        mockMvc.perform(delete("/api/v1/groups/" + groupId + "/members/" + a.userId())
                .header("Authorization", auth(a.token())))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("OWNER_MUST_DELEGATE"));

        // Delegate ownership to B, then A leaves OK
        mockMvc.perform(patch("/api/v1/groups/" + groupId + "/members/" + b.userId())
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON).content("{\"role\":\"owner\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.role").value("owner"));

        // groups.owner_id changed; A demoted to admin
        mockMvc.perform(get("/api/v1/groups/" + groupId).header("Authorization", auth(b.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ownerId").value(b.userId()))
            .andExpect(jsonPath("$.role").value("owner"));
        mockMvc.perform(get("/api/v1/groups").header("Authorization", auth(a.token())))
            .andExpect(jsonPath("$[0].role").value("admin"));

        // A (now admin) leaves OK
        mockMvc.perform(delete("/api/v1/groups/" + groupId + "/members/" + a.userId())
                .header("Authorization", auth(a.token())))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/groups").header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));

        // DELETE group by owner (B) -> 204 and gone from listings
        mockMvc.perform(delete("/api/v1/groups/" + groupId).header("Authorization", auth(b.token())))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/groups").header("Authorization", auth(b.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/v1/groups/" + groupId).header("Authorization", auth(b.token())))
            .andExpect(status().isNotFound());
    }
}
