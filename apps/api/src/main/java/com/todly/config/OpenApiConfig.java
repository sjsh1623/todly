package com.todly.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * springdoc OpenAPI metadata for the todly API.
 *
 * <p>Defines the API info shown in Swagger UI and a JWT bearer security scheme
 * ({@code bearer-jwt}) so the UI exposes an "Authorize" button. Endpoints are
 * auto-detected by springdoc; controllers need no hand annotation. Docs paths
 * ({@code /v3/api-docs/**}, {@code /swagger-ui/**}) are permitted in
 * {@link SecurityConfig}.
 */
@Configuration
public class OpenApiConfig {

    private static final String BEARER_SCHEME = "bearer-jwt";

    @Bean
    public OpenAPI todlyOpenAPI() {
        return new OpenAPI()
            .info(new Info()
                .title("todly API")
                .version("0.0.1")
                .description("REST + WebSocket API for todly — collaborative life-management "
                    + "for families, roommates, couples and friends. "
                    + "Authenticate via /api/v1/auth, then use the Bearer access token."))
            .addSecurityItem(new SecurityRequirement().addList(BEARER_SCHEME))
            .components(new Components()
                .addSecuritySchemes(BEARER_SCHEME, new SecurityScheme()
                    .name(BEARER_SCHEME)
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")));
    }
}
