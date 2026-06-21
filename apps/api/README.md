# todly-api

Spring Boot 3.3.x + Java 21 backend for Todly (PHASE 0 foundation skeleton).

## Run locally

Requires PostgreSQL and Redis to be reachable (defaults: Postgres on
`localhost:5432`, Redis on `localhost:6379`). Run them via docker compose, or
override with the `SPRING_DATASOURCE_*` and `SPRING_DATA_REDIS_URL` env vars.

```bash
./gradlew bootRun
```

Health check:

```bash
curl http://localhost:8080/api/v1/health
# {"status":"UP","service":"todly-api"}
```

## Build

```bash
./gradlew build
```

## Docker

```bash
docker build -t todly-api .
docker run -p 8080:8080 todly-api
```
