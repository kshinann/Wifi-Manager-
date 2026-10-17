# Releasing ChargeVerse to Google Play

## One time: create your upload key

The upload key proves future updates come from you. **Back it up and never
lose it or share it.** Keep it outside the project folder.

Windows (PowerShell), using the JDK that Android Studio installed:

```powershell
& "C:\Android\jdk\17.0.20\bin\keytool.exe" -genkey -v `
  -keystore "$env:USERPROFILE\chargeverse-upload.jks" `
  -storetype JKS -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Then create `android\key.properties` (git-ignored, never committed):

```properties
storePassword=<the keystore password you chose>
keyPassword=<the key password, usually the same>
keyAlias=upload
storeFile=C:/Users/<you>/chargeverse-upload.jks
```

Use forward slashes in `storeFile`.

## Every release

1. Bump `version:` in `pubspec.yaml`, e.g. `1.0.0+1` → `1.0.1+2`. The number
   after `+` must go up with every upload.
2. Build:
   ```powershell
   flutter clean
   flutter pub get
   flutter test
   flutter build appbundle --release
   ```
3. Upload `build\app\outputs\bundle\release\app-release.aab` in Play Console.

To try the exact release build on your phone first:
`flutter run --release -d <device-id>`.

## Play Console checklist (first release)

- **App icon:** `store/play_icon_512.png`.
- **Feature graphic:** 1024×500 PNG/JPG (not included yet).
- **Screenshots:** at least 2 phone screenshots of the charging screen.
- **Privacy policy URL:**
  `https://github.com/kshinann/Wifi-Manager-/blob/main/PRIVACY.md`
  (merge this branch into `main` first, and fill in the contact email).
- **App content → Data safety:** no data collected, no data shared.
- **App content → Foreground service permissions:** declare *Special use*,
  explain "Opens the charging screen when the user plugs in the charger, only
  after the user turns on Open when charging", and attach a short screen
  recording of plugging in.
- **App content → Full-screen intent:** declare its use (opening the charging
  screen over the lock screen). Play may deny it for non-alarm/calling apps
  on Android 14+; the app then falls back to a "tap to open" notification.
- **Content rating:** complete the questionnaire (no violence, no user
  content, etc.).
- **Target audience:** 13+ or 18+ (not designed for children).
- **Testing:** new personal developer accounts must run a closed test with
  at least 12 testers for 14 days before going to production.
