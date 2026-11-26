# Native Android integration

The three browser templates are now available in the Compose app. Open **Settings → App template** (or **Settings → Looks**) and choose **Aurora Glass**, **Rosemary Glass**, or **Cupid Player**. The same page offers System, Light, and Dark display modes. Cupid's player and the main screen headers also have a sun/moon button.

The original appearance remains available. Template selection sets presentation defaults at runtime, leaving stored layout preferences, accounts, library content, playback settings, and downloads intact. Choosing Original restores the stored presentation settings. Templates also travel with saved/shared Looks.

| Prototype | Native destination |
| --- | --- |
| Home | Existing Home repositories and sections; Cupid adds the illustrated record-room card |
| Search | Independent song search with on-phone results, history, and real playback |
| Your library | Existing saved playlists, albums, liked tracks and other library tabs |
| Now playing | Existing Media3 session; Cupid has its own native paper window and turntable illustration |
| Queue / lyrics | Existing reorderable queue and synced lyric panels inside Cupid's player |
| Sound / settings / menus | Existing Android output picker, settings, and player options |

Shared native cards, headers, navigation, mini player, sheets, typography, and icons follow the selected template. The custom Cupid player keeps the real song's artwork and metadata. Music videos and immersive playback retain the existing dedicated native player. The illustration is a vector, not a web view or screenshot.

Headers reserve room for titles and use a horizontally scrollable action row on narrow phones. Player controls are at least 48 dp; the scene adapts to available height, and the content can scroll at unusually large text sizes or in short windows. System-bar and navigation insets come from Android.

Original Cupid room art, 36 pixel symbols, and Lovebit font are exported from the reviewed prototype sources:

```powershell
py design/android-prototype/export-android-assets.py
.\gradlew.bat :app:assembleDebug
.\gradlew.bat :app:testDebugUnitTest --tests com.prism.music.NativeTemplatesTest
```

The exporter needs only Python's standard library. Remaining native function icons are converted to pixel drawings from the app's existing original vectors. No icon files from the reference folder are bundled.

The APK is generated at `app/build/outputs/apk/debug/app-debug.apk`. The browser preview remains a separate design sandbox; changes to native code require rebuilding the Android app.

Validation: Android debug APK assembled and its signature verified. 28 targeted tests pass across native template rendering/persistence, Look serialization/history labels, Search chips/keyboard state, and library search. Native Cupid player screenshots at 320 dp in both modes are generated under `app/build/settings-pages/native-templates/`. No physical Android device was connected during this run.
