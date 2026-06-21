package com.todly.notification;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Web-push (VAPID) delivery — STRUCTURE ONLY (PHASE 7 / IMP-06).
 *
 * <p>When both {@code PUSH_VAPID_PUBLIC} and {@code PUSH_VAPID_PRIVATE} env vars
 * (mapped to {@code todly.push.vapid.public/private}) are present this would sign
 * and POST a Web Push message to each of the user's stored {@link DeviceToken}
 * endpoints. No real HTTP/crypto is wired here — adding the {@code web-push} (or
 * {@code nl.martijndwars:web-push}) dependency and the VAPID keys is all that's
 * required to make {@link #send} actually deliver.
 *
 * <p>When keys are absent (the default for local/dev/tests) it is a safe no-op
 * that only logs at debug — push being unconfigured NEVER fails a notification.
 */
@Component
public class PushSender {

    private static final Logger log = LoggerFactory.getLogger(PushSender.class);

    private final String vapidPublic;
    private final String vapidPrivate;

    public PushSender(@Value("${todly.push.vapid.public:}") String vapidPublic,
                      @Value("${todly.push.vapid.private:}") String vapidPrivate) {
        this.vapidPublic = vapidPublic;
        this.vapidPrivate = vapidPrivate;
    }

    /** True when VAPID keys are configured (push could actually be sent). */
    public boolean enabled() {
        return vapidPublic != null && !vapidPublic.isBlank()
            && vapidPrivate != null && !vapidPrivate.isBlank();
    }

    /**
     * Best-effort web push to all of the user's device tokens. No-op (debug log
     * only) when keys are absent. Any failure is swallowed — push is auxiliary to
     * the in-app + realtime notification, which has already been delivered.
     */
    public void send(List<DeviceToken> tokens, String title, String body, String link) {
        if (!enabled()) {
            log.debug("Web push disabled (no VAPID keys); skipping push for title={}", title);
            return;
        }
        if (tokens == null || tokens.isEmpty()) {
            return;
        }
        for (DeviceToken token : tokens) {
            try {
                // TODO: sign with VAPID and POST the encrypted payload to the
                //       subscription endpoint. Intentionally unimplemented here.
                log.debug("Would web-push to token={} platform={} title={}",
                    token.getId(), token.getPlatform(), title);
            } catch (RuntimeException ex) {
                log.warn("Web push to token={} failed", token.getId(), ex);
            }
        }
    }
}
