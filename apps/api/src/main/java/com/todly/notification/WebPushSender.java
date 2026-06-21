package com.todly.notification;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import nl.martijndwars.webpush.Subscription;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.security.Security;
import java.util.List;

/**
 * Web Push (VAPID) delivery for PWA subscriptions (platform = web).
 *
 * <p>Each web {@link DeviceToken#getToken()} stores the full browser
 * {@code PushSubscription} JSON ({@code {endpoint, keys:{p256dh, auth}}}). When
 * VAPID keys are configured this signs and POSTs an encrypted payload to each
 * subscription's push service. Absent keys → safe no-op (debug log only); push
 * being unconfigured NEVER fails the in-app/realtime notification.
 */
@Component
public class WebPushSender {

    private static final Logger log = LoggerFactory.getLogger(WebPushSender.class);

    private final String publicKey;
    private final String privateKey;
    private final String subject;
    private final ObjectMapper mapper = new ObjectMapper();
    private final DeviceTokenRepository deviceTokenRepository;

    private PushService pushService;

    public WebPushSender(@Value("${todly.push.vapid.public:}") String publicKey,
                         @Value("${todly.push.vapid.private:}") String privateKey,
                         @Value("${todly.push.vapid.subject:mailto:support@todly.app}") String subject,
                         DeviceTokenRepository deviceTokenRepository) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.subject = subject;
        this.deviceTokenRepository = deviceTokenRepository;
    }

    public boolean enabled() {
        return publicKey != null && !publicKey.isBlank()
            && privateKey != null && !privateKey.isBlank();
    }

    @PostConstruct
    void init() {
        if (!enabled()) {
            log.info("Web push disabled (no VAPID keys).");
            return;
        }
        try {
            if (Security.getProvider(BouncyCastleProvider.PROVIDER_NAME) == null) {
                Security.addProvider(new BouncyCastleProvider());
            }
            this.pushService = new PushService(publicKey, privateKey, subject);
            log.info("Web push enabled (VAPID).");
        } catch (Exception ex) {
            log.error("Failed to initialize web push; disabling.", ex);
            this.pushService = null;
        }
    }

    /**
     * Best-effort web push to each subscription. Stale subscriptions (404/410)
     * are pruned. Any per-token failure is swallowed and logged.
     *
     * @param payload the JSON the service worker's `push` handler reads
     *                ({@code {title, body, url}})
     */
    public void send(List<DeviceToken> webTokens, String payload) {
        if (pushService == null || webTokens == null || webTokens.isEmpty()) {
            return;
        }
        for (DeviceToken token : webTokens) {
            try {
                Subscription subscription = mapper.readValue(token.getToken(), Subscription.class);
                Notification notification = new Notification(subscription, payload);
                var response = pushService.send(notification);
                int status = response.getStatusLine().getStatusCode();
                if (status == 404 || status == 410) {
                    // Subscription is gone — drop it so we stop retrying.
                    deviceTokenRepository.delete(token);
                    log.debug("Pruned stale web push subscription token={} (HTTP {})", token.getId(), status);
                } else if (status >= 400) {
                    log.warn("Web push to token={} returned HTTP {}", token.getId(), status);
                }
            } catch (Exception ex) {
                log.warn("Web push to token={} failed: {}", token.getId(), ex.getMessage());
            }
        }
    }
}
