package com.todly.friend;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end friend system flow (PHASE 8) against real PostgreSQL 16
 * (Testcontainers) with Flyway, Redis autoconfig excluded, real Bearer auth.
 *
 * Covers: search + relation, request/accept, notifications, sharedGroups,
 * reverse auto-accept, decline, block, unfriend, and group invite-friends.
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
class FriendFlowTest {

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

    private JsonNode json(MvcResult res) throws Exception {
        return objectMapper.readTree(res.getResponse().getContentAsString());
    }

    @Test
    void fullFriendFlow() throws Exception {
        Account a = signup("alice_f", "alice_f@todly.dev");
        Account b = signup("bob_f", "bob_f@todly.dev");
        Account c = signup("carol_f", "carol_f@todly.dev");

        // --- A searches "bob_f" -> finds B, relation none ---
        mockMvc.perform(get("/api/v1/users/search").param("q", "bob_f")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].userId").value(b.userId()))
            .andExpect(jsonPath("$[0].username").value("bob_f"))
            .andExpect(jsonPath("$[0].relation").value("none"))
            .andExpect(jsonPath("$[0].sharedGroups").value(0));

        // search excludes myself
        mockMvc.perform(get("/api/v1/users/search").param("q", "alice_f")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.length()").value(0));

        // --- A sends a friend request to B ---
        mockMvc.perform(post("/api/v1/friends/requests")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"bob_f\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("pending"))
            .andExpect(jsonPath("$.request.toUser.userId").value(b.userId()));

        // duplicate -> 409 REQUEST_EXISTS
        mockMvc.perform(post("/api/v1/friends/requests")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"bob_f\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("REQUEST_EXISTS"));

        // A's perspective: relation outgoing
        mockMvc.perform(get("/api/v1/users/search").param("q", "bob_f")
                .header("Authorization", auth(a.token())))
            .andExpect(jsonPath("$[0].relation").value("outgoing"));

        // B sees incoming request
        MvcResult reqRes = mockMvc.perform(get("/api/v1/friends/requests")
                .header("Authorization", auth(b.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.incoming.length()").value(1))
            .andExpect(jsonPath("$.incoming[0].fromUser.userId").value(a.userId()))
            .andReturn();
        String requestId = json(reqRes).get("incoming").get(0).get("id").asText();

        // B has a friend_request notification
        mockMvc.perform(get("/api/v1/me/notifications")
                .header("Authorization", auth(b.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.items[?(@.type=='friend_request')]").isNotEmpty());

        // --- B accepts ---
        mockMvc.perform(post("/api/v1/friends/requests/" + requestId + "/accept")
                .header("Authorization", auth(b.token())))
            .andExpect(status().isOk());

        // both see each other as friends
        mockMvc.perform(get("/api/v1/friends").header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].userId").value(b.userId()));
        mockMvc.perform(get("/api/v1/friends").header("Authorization", auth(b.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].userId").value(a.userId()));

        // A has a friend_accepted notification
        mockMvc.perform(get("/api/v1/me/notifications")
                .header("Authorization", auth(a.token())))
            .andExpect(jsonPath("$.items[?(@.type=='friend_accepted')]").isNotEmpty());

        // search now shows relation friend
        mockMvc.perform(get("/api/v1/users/search").param("q", "bob_f")
                .header("Authorization", auth(a.token())))
            .andExpect(jsonPath("$[0].relation").value("friend"));

        // already friends -> 409
        mockMvc.perform(post("/api/v1/friends/requests")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + b.userId() + "\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("ALREADY_FRIENDS"));

        // --- sharedGroups: put A and B in a common group ---
        MvcResult grp = mockMvc.perform(post("/api/v1/groups")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"Crew\",\"type\":\"group\",\"color\":\"green\"}"))
            .andExpect(status().isCreated())
            .andReturn();
        String groupId = json(grp).get("id").asText();

        // invite B (a friend) directly -> added
        mockMvc.perform(post("/api/v1/groups/" + groupId + "/invite-friends")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userIds\":[\"" + b.userId() + "\"]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.added[0]").value(b.userId()))
            .andExpect(jsonPath("$.skipped.length()").value(0));

        // B is now a member
        mockMvc.perform(get("/api/v1/groups").header("Authorization", auth(b.token())))
            .andExpect(jsonPath("$[?(@.id=='" + groupId + "')]").isNotEmpty());

        // friends list now shows sharedGroups >= 1
        mockMvc.perform(get("/api/v1/friends").header("Authorization", auth(a.token())))
            .andExpect(jsonPath("$[0].sharedGroups").value(org.hamcrest.Matchers.greaterThanOrEqualTo(1)));

        // re-invite B (already member) -> skipped; invite C (non-friend) -> skipped
        mockMvc.perform(post("/api/v1/groups/" + groupId + "/invite-friends")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userIds\":[\"" + b.userId() + "\",\"" + c.userId() + "\"]}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.added.length()").value(0))
            .andExpect(jsonPath("$.skipped.length()").value(2));

        // non-owner/admin caller -> 403 (C is not even a member)
        mockMvc.perform(post("/api/v1/groups/" + groupId + "/invite-friends")
                .header("Authorization", auth(c.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userIds\":[\"" + a.userId() + "\"]}"))
            .andExpect(status().isForbidden());

        // --- Reverse auto-accept: C requests A, then A requests C -> accepted ---
        mockMvc.perform(post("/api/v1/friends/requests")
                .header("Authorization", auth(c.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + a.userId() + "\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("pending"));

        mockMvc.perform(post("/api/v1/friends/requests")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + c.userId() + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("accepted"));

        // A and C are now friends; no leftover pending request
        mockMvc.perform(get("/api/v1/friends").header("Authorization", auth(a.token())))
            .andExpect(jsonPath("$[?(@.userId=='" + c.userId() + "')]").isNotEmpty());
        mockMvc.perform(get("/api/v1/friends/requests").header("Authorization", auth(a.token())))
            .andExpect(jsonPath("$.outgoing.length()").value(0));
        mockMvc.perform(get("/api/v1/friends/requests").header("Authorization", auth(c.token())))
            .andExpect(jsonPath("$.outgoing.length()").value(0));

        // --- Unfriend: A unfriends B ---
        mockMvc.perform(delete("/api/v1/friends/" + b.userId())
                .header("Authorization", auth(a.token())))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/friends").header("Authorization", auth(a.token())))
            .andExpect(jsonPath("$[?(@.userId=='" + b.userId() + "')]").isEmpty());

        // unfriend again -> 404
        mockMvc.perform(delete("/api/v1/friends/" + b.userId())
                .header("Authorization", auth(a.token())))
            .andExpect(status().isNotFound());

        // --- Decline: A re-requests B, B declines -> not friends, request gone ---
        mockMvc.perform(post("/api/v1/friends/requests")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + b.userId() + "\"}"))
            .andExpect(status().isCreated());
        MvcResult bReq = mockMvc.perform(get("/api/v1/friends/requests")
                .header("Authorization", auth(b.token())))
            .andExpect(jsonPath("$.incoming.length()").value(1))
            .andReturn();
        String declineId = json(bReq).get("incoming").get(0).get("id").asText();
        mockMvc.perform(post("/api/v1/friends/requests/" + declineId + "/decline")
                .header("Authorization", auth(b.token())))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/friends/requests").header("Authorization", auth(b.token())))
            .andExpect(jsonPath("$.incoming.length()").value(0));
        mockMvc.perform(get("/api/v1/friends").header("Authorization", auth(a.token())))
            .andExpect(jsonPath("$[?(@.userId=='" + b.userId() + "')]").isEmpty());

        // --- Block: A blocks C, C cannot send a request, then A unblocks ---
        // First unfriend A<->C so we can test the block path cleanly.
        mockMvc.perform(delete("/api/v1/friends/" + c.userId())
                .header("Authorization", auth(a.token())))
            .andExpect(status().isNoContent());

        mockMvc.perform(post("/api/v1/friends/" + c.userId() + "/block")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isNoContent());

        // C cannot send a request to A -> 403 BLOCKED
        mockMvc.perform(post("/api/v1/friends/requests")
                .header("Authorization", auth(c.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + a.userId() + "\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("BLOCKED"));

        // C searching for A should not see A (A blocked C)
        mockMvc.perform(get("/api/v1/users/search").param("q", "alice_f")
                .header("Authorization", auth(c.token())))
            .andExpect(jsonPath("$.length()").value(0));

        // A unblocks C -> C may request again
        mockMvc.perform(delete("/api/v1/friends/" + c.userId() + "/block")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isNoContent());
        mockMvc.perform(post("/api/v1/friends/requests")
                .header("Authorization", auth(c.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + a.userId() + "\"}"))
            .andExpect(status().isCreated());

        // self request -> 400
        mockMvc.perform(post("/api/v1/friends/requests")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + a.userId() + "\"}"))
            .andExpect(status().isBadRequest());

        // unknown username -> 404 USER_NOT_FOUND
        mockMvc.perform(post("/api/v1/friends/requests")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"nobody_xyz\"}"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.code").value("USER_NOT_FOUND"));

        assertThat(true).isTrue();
    }
}
