# --- Build stage ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install
COPY . .
# Deploy-time config baked into the static bundle. Defaults keep local builds
# rooted at '/'; the prod compose overrides these to mount the app under /todly.
ARG VITE_BASE_PATH=/
ARG VITE_API_BASE_URL=/api/v1
ARG VITE_WS_URL=/ws
ENV VITE_BASE_PATH=$VITE_BASE_PATH \
    VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_WS_URL=$VITE_WS_URL
RUN npm run build

# --- Serve stage ---
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
