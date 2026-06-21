package com.todly.notification;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.ApnsConfig;
import com.google.firebase.messaging.Aps;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.FileInputStream;
import java.io.InputStream;
import java.util.List;

/**
 * Native push (iOS + Android) via Firebase Cloud Messaging. FCM delivers to
 * Android directly and to iOS through APNs, so a single Firebase project covers
 * both native platforms (tokens are the per-device registration tokens reported
 * by the Capacitor PushNotifications plugin).
 *
 * <p>Gated on a Firebase service-account JSON ({@code todly.push.fcm.credentials}
 * or the standard {@code GOOGLE_APPLICATION_CREDENTIALS}). Absent → safe no-op.
 * Unregistered/invalid tokens are pruned.
 */
@Component
public class FcmSender {

    private static final Logger log = LoggerFactory.getLogger(FcmSender.class);

    private final String credentialsPath;
    private final DeviceTokenRepository deviceTokenRepository;

    private FirebaseMessaging messaging;

    public FcmSender(@Value("${todly.push.fcm.credentials:}") String credentialsPath,
                     DeviceTokenRepository deviceTokenRepository) {
        this.credentialsPath = credentialsPath;
        this.deviceTokenRepository = deviceTokenRepository;
    }

    public boolean enabled() {
        return messaging != null;
    }

    @PostConstruct
    void init() {
        GoogleCredentials credentials = loadCredentials();
        if (credentials == null) {
            log.info("Native push (FCM) disabled (no service-account credentials).");
            return;
        }
        try {
            FirebaseOptions options = FirebaseOptions.builder()
                .setCredentials(credentials)
                .build();
            FirebaseApp app = FirebaseApp.getApps().stream()
                .filter(a -> "todly-push".equals(a.getName()))
                .findFirst()
                .orElseGet(() -> FirebaseApp.initializeApp(options, "todly-push"));
            this.messaging = FirebaseMessaging.getInstance(app);
            log.info("Native push (FCM) enabled.");
        } catch (Exception ex) {
            log.error("Failed to initialize FCM; native push disabled.", ex);
            this.messaging = null;
        }
    }

    private GoogleCredentials loadCredentials() {
        try {
            if (credentialsPath != null && !credentialsPath.isBlank()) {
                try (InputStream in = new FileInputStream(credentialsPath)) {
                    return GoogleCredentials.fromStream(in);
                }
            }
            // Fall back to the ambient GOOGLE_APPLICATION_CREDENTIALS, if present.
            if (System.getenv("GOOGLE_APPLICATION_CREDENTIALS") != null) {
                return GoogleCredentials.getApplicationDefault();
            }
        } catch (Exception ex) {
            log.warn("Could not load FCM credentials: {}", ex.getMessage());
        }
        return null;
    }

    /** Best-effort native push to each device token. Prunes dead tokens. */
    public void send(List<DeviceToken> nativeTokens, String title, String body, String link) {
        if (messaging == null || nativeTokens == null || nativeTokens.isEmpty()) {
            return;
        }
        for (DeviceToken token : nativeTokens) {
            try {
                Message message = Message.builder()
                    .setToken(token.getToken())
                    .setNotification(com.google.firebase.messaging.Notification.builder()
                        .setTitle(title)
                        .setBody(body)
                        .build())
                    .putData("url", link == null ? "" : link)
                    .setAndroidConfig(AndroidConfig.builder()
                        .setPriority(AndroidConfig.Priority.HIGH)
                        .build())
                    .setApnsConfig(ApnsConfig.builder()
                        .setAps(Aps.builder().setSound("default").build())
                        .build())
                    .build();
                messaging.send(message);
            } catch (FirebaseMessagingException ex) {
                MessagingErrorCode code = ex.getMessagingErrorCode();
                if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT) {
                    deviceTokenRepository.delete(token);
                    log.debug("Pruned dead FCM token={} ({})", token.getId(), code);
                } else {
                    log.warn("FCM push to token={} failed ({})", token.getId(), code);
                }
            } catch (Exception ex) {
                log.warn("FCM push to token={} failed: {}", token.getId(), ex.getMessage());
            }
        }
    }
}
