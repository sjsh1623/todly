# todly — Native iOS / Android (Capacitor)

The mobile apps wrap the same React/Vite PWA in native shells via
[Capacitor](https://capacitorjs.com). 100% of the UI is the web build; native
code lives in `ios/` and `android/`.

## Build flow

```bash
npm install
npm run build          # produce dist/
npx cap sync           # copy dist/ into ios/ + android/, update plugins

# iOS  (needs Xcode + CocoaPods)
npx cap open ios       # Xcode ▸ select a Simulator/device ▸ Run / Archive
# or headless (Simulator, unsigned):
cd ios/App && xcodebuild -project App.xcodeproj -scheme App \
  -sdk iphonesimulator -configuration Debug \
  -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build

# Android  (needs Android SDK; ANDROID_HOME or android/local.properties)
cd android && ./gradlew assembleDebug   # → app/build/outputs/apk/debug/app-debug.apk
npx cap open android                     # or open in Android Studio ▸ Run
```

`npm run gen:icons` regenerates the brand icons/splash sources in `assets/`;
`npx @capacitor/assets generate` expands them into the native icon/splash sets.

## Apple Developer account / signing

todly is configured for the **Mohe** Apple Developer team (shared with the
`withy` app), so it can be signed/archived/submitted with that account.

| Setting | Value |
|---|---|
| Apple Team ID (`DEVELOPMENT_TEAM`) | `B7JXA8GGC8` |
| iOS bundle id | `today.mohe.todly` |
| Android applicationId | `today.mohe.todly` |
| Signing style | Automatic (`-allowProvisioningUpdates`) |
| APNs auth key | Key ID `5T5Q7ZZDYJ` (Team `B7JXA8GGC8`) — `~/Desktop/Developer/Mohe/tossa/secrets/AuthKey_5T5Q7ZZDYJ.p8` |
| Firebase project (for Google sign-in / FCM) | project number `547448970696` |

Set in `ios/App/App.xcodeproj/project.pbxproj` (team + bundle id +
`App/App.entitlements`) and `android/app/build.gradle` (applicationId).

### ⚠️ One manual step before device builds / TestFlight

A signed device build currently fails with:

> *PLA Update available: You currently don't have access to this membership
> resource. To resolve this issue, agree to the latest Program License
> Agreement in your developer account.*

The Apple ID is logged into Xcode and has team access, but Apple is blocking new
provisioning profiles until the **updated Program License Agreement is accepted**.
Fix (account owner only): sign in at <https://developer.apple.com/account> (and
App Store Connect), accept the latest agreements, then re-run:

```bash
cd ios/App && xcodebuild -project App.xcodeproj -scheme App \
  -sdk iphoneos -configuration Debug -destination 'generic/platform=iOS' \
  -allowProvisioningUpdates build
```

Simulator builds (`CODE_SIGNING_ALLOWED=NO`) and Android builds work today.

## Push notifications

Push is implemented end-to-end and is **config-gated** — it is a safe no-op
until you supply credentials.

### Web (PWA) — VAPID

1. Generate a VAPID keypair, e.g. `npx web-push generate-vapid-keys`.
2. Backend: set `PUSH_VAPID_PUBLIC`, `PUSH_VAPID_PRIVATE`, `PUSH_VAPID_SUBJECT`.
3. Frontend: set `VITE_VAPID_PUBLIC_KEY` to the **same public key**, rebuild.

The service worker push handlers live in `public/push-sw.js` (imported by the
Workbox SW). Subscriptions are created in `src/features/push/register.ts` and
stored server-side in `device_tokens` (platform `web`).

### Native — Firebase Cloud Messaging (iOS via APNs, Android direct)

Backend uses Firebase Admin; both platforms register FCM/APNs tokens through the
Capacitor PushNotifications plugin (platform `ios` / `android`).

1. Create a Firebase project; download the service-account JSON.
2. Backend: set `PUSH_FCM_CREDENTIALS=/path/to/service-account.json`
   (or the standard `GOOGLE_APPLICATION_CREDENTIALS`).
3. **Android:** put `google-services.json` in `android/app/`, and add the Google
   Services Gradle plugin (`com.google.gms.google-services`) to
   `android/app/build.gradle` + the classpath in `android/build.gradle`.
4. **iOS:** in Xcode, add the **Push Notifications** capability (creates the
   `aps-environment` entitlement) and **Background Modes ▸ Remote notifications**.
   Upload your APNs auth key to the Firebase project. Requires an Apple Developer
   account + provisioning profile with Push enabled.

Once configured, creating a notification (`NotificationService`) fans out to
`PushSender`, which routes web tokens to `WebPushSender` (VAPID) and native
tokens to `FcmSender` (FCM/APNs).
