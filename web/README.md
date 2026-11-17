# Aftertone Web

Sign in with the same ID and password on Android and the web. The server uses Firebase Authentication to check every account and Firebase Realtime Database to keep per-account music libraries. User signups are free in the app and enabled by default. The **Accounts** page is visible to the configured administrator and can disable or re-enable other accounts. Disabling an account revokes its sessions and blocks future playback and sync requests.

## Deploy

1. Use your existing dedicated Aftertone Firebase project, or create one for Aftertone. Enable **Email/Password** in Authentication, register a Firebase web app for its API key, and create a Realtime Database in locked mode. The Firebase Admin SDK accesses the shared libraries on the server. Leave direct client access to `aftertoneLibraries` denied. If you have an existing Aftertone backup database, preserve its existing `backups` rules and use that same project's ID and database URL.
2. In the [Render dashboard](https://dashboard.render.com/), create a Blueprint from this repository. The root `render.yaml` creates the web service. For another container host, build the Docker image using `web/` as the context and expose port 10000 over HTTPS.
3. Set `FIREBASE_PROJECT_ID`, `FIREBASE_DATABASE_URL`, and `FIREBASE_API_KEY` from the Firebase project. Set `FIREBASE_SERVICE_ACCOUNT` to the Firebase server service account JSON in the host's secret settings. On a Google-managed host, you can use Application Default Credentials in place of that last variable. Use a service account with permission to manage Firebase Authentication users and access Realtime Database.
4. Sign in to the hosted app with the intended administrator account, or create it. In the Firebase console's Authentication users list, copy that account's **User UID** into the host's `AFTERTONE_ADMIN_UID` setting and redeploy. Sign in again to see **Accounts**. Do the same for your existing Aftertone sign-in if you intend to keep that account. The legacy phone ID format is supported.
5. Build Android with the new HTTPS URL using `./gradlew :app:assembleRelease -PaftertoneServer=https://your-app.onrender.com`. You can also put the URL in the Android checkout's ignored `local.properties` under `aftertone.serverUrl`. Use the signing key for your installed APK to upgrade it in place. Once you sign in, the app uploads your existing on-device library and pulls your web changes. An Android installation links its existing library to its first Aftertone account. Use separate Android user profiles if people share a device.

The shared library includes ordered likes, regular playlists created or imported into Aftertone, and the most recent 3,000 portable plays. Local audio files, smart-playlist rules, and previously cached downloads remain device-specific. Track metadata and history are synced. Audio is fetched as you play. The web and Android recommenders use the shared listening signals, with platform-specific ranking.

Render's [free service](https://render.com/docs/free) has idle spin-down and bandwidth limits. Exercise playback through the deployed URL. Whether an upstream stream is available depends on the host's network and the track.

## Local development

Install Node.js 24+, Java 21+, Firebase CLI, and `yt-dlp`. Run from the repository root:

```sh
firebase emulators:start --only auth,database --project demo-aftertone --config cloud/firebase.json
```

From `web/`, install with `npm ci`. Set the following environment variables for the same shell in which you run `npm start`:

```dotenv
FIREBASE_PROJECT_ID=demo-aftertone
FIREBASE_DATABASE_URL=http://127.0.0.1:9000?ns=demo-aftertone-default-rtdb
FIREBASE_API_KEY=demo-key
FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099
FIREBASE_DATABASE_EMULATOR_HOST=127.0.0.1:9000
```

Open `http://127.0.0.1:4371` and create a test account without using a real password. Set `AFTERTONE_ADMIN_UID` using the UID shown in the emulator's users list and restart the web server to try the admin page.
