package com.todly.notification;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Push dispatcher. Splits a user's device tokens by platform and delegates to
 * the right transport:
 * <ul>
 *   <li>{@code web}            → {@link WebPushSender} (VAPID / Web Push)</li>
 *   <li>{@code ios}/{@code android} → {@link FcmSender} (Firebase Cloud Messaging)</li>
 * </ul>
 *
 * <p>Each transport is independently config-gated; when neither is configured
 * this is a safe no-op. Push is always auxiliary to the in-app + realtime
 * notification, which has already been delivered, so failures never propagate.
 */
@Component
public class PushSender {

    private static final Logger log = LoggerFactory.getLogger(PushSender.class);

    private final WebPushSender webPushSender;
    private final FcmSender fcmSender;
    private final ObjectMapper mapper = new ObjectMapper();

    public PushSender(WebPushSender webPushSender, FcmSender fcmSender) {
        this.webPushSender = webPushSender;
        this.fcmSender = fcmSender;
    }

    /** True when at least one transport is configured. */
    public boolean enabled() {
        return webPushSender.enabled() || fcmSender.enabled();
    }

    /**
     * Best-effort push to all of the user's device tokens, routed by platform.
     */
    public void send(List<DeviceToken> tokens, String title, String body, String link) {
        if (tokens == null || tokens.isEmpty()) {
            return;
        }
        List<DeviceToken> web = tokens.stream()
            .filter(t -> t.getPlatform() == DevicePlatform.web)
            .toList();
        List<DeviceToken> nativeTokens = tokens.stream()
            .filter(t -> t.getPlatform() == DevicePlatform.ios || t.getPlatform() == DevicePlatform.android)
            .toList();

        if (!web.isEmpty()) {
            webPushSender.send(web, buildWebPayload(title, body, link));
        }
        if (!nativeTokens.isEmpty()) {
            fcmSender.send(nativeTokens, title, body, link);
        }
    }

    /** Serializes the payload the service worker `push` handler expects. */
    private String buildWebPayload(String title, String body, String link) {
        Map<String, String> payload = new LinkedHashMap<>();
        payload.put("title", title == null ? "todly" : title);
        payload.put("body", body == null ? "" : body);
        payload.put("url", link == null ? "/" : link);
        try {
            return mapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            // Fields are plain strings; this should never happen.
            log.warn("Failed to serialize web push payload", e);
            return "{\"title\":\"todly\"}";
        }
    }
}
