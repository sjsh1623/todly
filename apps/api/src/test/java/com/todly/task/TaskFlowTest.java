package com.todly.task;

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

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end section/task/subtask/home flow against a real PostgreSQL 16
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
class TaskFlowTest {

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

    private String createGroup(Account a, String name) throws Exception {
        String body = """
            {"name":"%s","type":"group","color":"blue","icon":"home"}""".formatted(name);
        MvcResult res = mockMvc.perform(post("/api/v1/groups")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();
    }

    private String createTask(Account a, String groupId, String sectionId, String title)
            throws Exception {
        String section = sectionId == null ? "" : "\"sectionId\":\"" + sectionId + "\",";
        String body = "{\"groupId\":\"" + groupId + "\"," + section
            + "\"title\":\"" + title + "\"}";
        MvcResult res = mockMvc.perform(post("/api/v1/tasks")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.status").value("todo"))
            .andExpect(jsonPath("$.priority").value("none"))
            .andExpect(jsonPath("$.creatorId").value(a.userId()))
            .andReturn();
        return objectMapper.readTree(res.getResponse().getContentAsString()).get("id").asText();
    }

    @Test
    void fullTaskFlow() throws Exception {
        Account a = signup("alice", "alice@todly.dev");
        String groupId = createGroup(a, "Household");

        // create a section
        MvcResult secRes = mockMvc.perform(post("/api/v1/groups/" + groupId + "/sections")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"Chores\",\"position\":0}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Chores"))
            .andExpect(jsonPath("$.groupId").value(groupId))
            .andReturn();
        String sectionId = objectMapper.readTree(secRes.getResponse().getContentAsString())
            .get("id").asText();

        // 5 tasks in the section
        String[] taskIds = new String[5];
        for (int i = 0; i < 5; i++) {
            taskIds[i] = createTask(a, groupId, sectionId, "Task " + i);
        }

        // GET group tasks -> progress 0/5, nested under the section
        mockMvc.perform(get("/api/v1/groups/" + groupId + "/tasks")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.progress.total").value(5))
            .andExpect(jsonPath("$.progress.done").value(0))
            .andExpect(jsonPath("$.progress.percent").value(0))
            .andExpect(jsonPath("$.sections[0].id").value(sectionId))
            .andExpect(jsonPath("$.sections[0].progress.total").value(5))
            .andExpect(jsonPath("$.sections[0].progress.done").value(0))
            .andExpect(jsonPath("$.sections[0].tasks.length()").value(5))
            .andExpect(jsonPath("$.unsectioned.length()").value(0));

        // complete 4 -> progress 80% (4/5)
        for (int i = 0; i < 4; i++) {
            mockMvc.perform(post("/api/v1/tasks/" + taskIds[i] + "/complete")
                    .header("Authorization", auth(a.token())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("done"))
                .andExpect(jsonPath("$.completedBy").value(a.userId()))
                .andExpect(jsonPath("$.completedAt").isNotEmpty());
        }

        mockMvc.perform(get("/api/v1/groups/" + groupId + "/tasks")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.progress.total").value(5))
            .andExpect(jsonPath("$.progress.done").value(4))
            .andExpect(jsonPath("$.progress.percent").value(80))
            .andExpect(jsonPath("$.sections[0].progress.done").value(4));

        // reopen one -> progress drops to 3/5 (60%)
        mockMvc.perform(post("/api/v1/tasks/" + taskIds[0] + "/reopen")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status").value("todo"))
            .andExpect(jsonPath("$.completedAt").doesNotExist());

        mockMvc.perform(get("/api/v1/groups/" + groupId + "/tasks")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.progress.done").value(3))
            .andExpect(jsonPath("$.progress.percent").value(60));

        // --- optimistic lock ---
        // read current version of task 4 (still todo)
        MvcResult t4 = mockMvc.perform(get("/api/v1/tasks/" + taskIds[4])
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andReturn();
        int version = objectMapper.readTree(t4.getResponse().getContentAsString())
            .get("version").asInt();

        // stale version -> 409 VERSION_CONFLICT
        mockMvc.perform(patch("/api/v1/tasks/" + taskIds[4])
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + (version - 1) + ",\"title\":\"stale\"}"))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));

        // correct version -> 200 and version increments
        mockMvc.perform(patch("/api/v1/tasks/" + taskIds[4])
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":" + version + ",\"title\":\"renamed\",\"priority\":\"high\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.title").value("renamed"))
            .andExpect(jsonPath("$.priority").value("high"))
            .andExpect(jsonPath("$.version").value(version + 1));

        // --- assign self with dueDate today -> needsAttention danger ---
        LocalDate today = LocalDate.now();
        String todayTask = createTask(a, groupId, null, "Due today");
        mockMvc.perform(patch("/api/v1/tasks/" + todayTask)
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":0,\"dueDate\":\"" + today + "\"}"))
            .andExpect(status().isOk());
        // "내가 할게요" -> post own id
        mockMvc.perform(post("/api/v1/tasks/" + todayTask + "/assignees")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + a.userId() + "\"}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.assignees[0].userId").value(a.userId()))
            .andExpect(jsonPath("$.assignees[0].nickname").value("alice"));

        // overdue task assigned to self
        LocalDate overdue = today.minusDays(3);
        String overdueTask = createTask(a, groupId, null, "Overdue");
        mockMvc.perform(patch("/api/v1/tasks/" + overdueTask)
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"version\":0,\"dueDate\":\"" + overdue + "\"}"))
            .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/tasks/" + overdueTask + "/assignees")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"userId\":\"" + a.userId() + "\"}"))
            .andExpect(status().isOk());

        // home summary: overdue first (warning), then today (danger)
        mockMvc.perform(get("/api/v1/home/summary").header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.greeting.name").value("alice"))
            .andExpect(jsonPath("$.greeting.phrase").isNotEmpty())
            .andExpect(jsonPath("$.liveNow.length()").value(0))
            .andExpect(jsonPath("$.needsAttention.length()").value(2))
            .andExpect(jsonPath("$.needsAttention[0].taskId").value(overdueTask))
            .andExpect(jsonPath("$.needsAttention[0].level").value("warning"))
            .andExpect(jsonPath("$.needsAttention[0].daysOverdue").value(3))
            .andExpect(jsonPath("$.needsAttention[1].taskId").value(todayTask))
            .andExpect(jsonPath("$.needsAttention[1].level").value("danger"))
            .andExpect(jsonPath("$.groupProgress[0].groupId").value(groupId))
            .andExpect(jsonPath("$.groupProgress[0].members[0].nickname").value("alice"));

        // --- subtasks: add / toggle / delete ---
        MvcResult subRes = mockMvc.perform(post("/api/v1/tasks/" + taskIds[4] + "/subtasks")
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"title\":\"step 1\"}"))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("step 1"))
            .andExpect(jsonPath("$.isDone").value(false))
            .andReturn();
        String subId = objectMapper.readTree(subRes.getResponse().getContentAsString())
            .get("id").asText();

        mockMvc.perform(patch("/api/v1/subtasks/" + subId)
                .header("Authorization", auth(a.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"isDone\":true}"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.isDone").value(true));

        mockMvc.perform(get("/api/v1/tasks/" + taskIds[4])
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.subtasks.length()").value(1))
            .andExpect(jsonPath("$.subtasks[0].isDone").value(true));

        mockMvc.perform(delete("/api/v1/subtasks/" + subId)
                .header("Authorization", auth(a.token())))
            .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/tasks/" + taskIds[4])
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.subtasks.length()").value(0));

        // --- section delete sets tasks unsectioned ---
        mockMvc.perform(delete("/api/v1/sections/" + sectionId)
                .header("Authorization", auth(a.token())))
            .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/groups/" + groupId + "/tasks")
                .header("Authorization", auth(a.token())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.sections.length()").value(0))
            .andExpect(jsonPath("$.unsectioned.length()").value(7));

        // --- non-member: 403 on read/create ---
        Account stranger = signup("mallory", "mallory@todly.dev");
        mockMvc.perform(get("/api/v1/groups/" + groupId + "/tasks")
                .header("Authorization", auth(stranger.token())))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mockMvc.perform(post("/api/v1/tasks")
                .header("Authorization", auth(stranger.token()))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"groupId\":\"" + groupId + "\",\"title\":\"sneaky\"}"))
            .andExpect(status().isForbidden())
            .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        assertThat(taskIds).hasSize(5);
    }
}
