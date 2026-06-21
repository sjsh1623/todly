-- Web Push (VAPID) subscriptions are stored as the full PushSubscription JSON
-- (endpoint + p256dh + auth keys), which can exceed 512 chars for some push
-- service endpoints. Native FCM/APNs tokens are short, but widen to TEXT so a
-- single column covers both transports. The UNIQUE constraint is preserved.
ALTER TABLE device_tokens ALTER COLUMN token TYPE TEXT;
