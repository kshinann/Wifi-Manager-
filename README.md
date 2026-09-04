# Multi Repellent

An Android (Kotlin + Jetpack Compose) app that plays adjustable-frequency tones
marketed for "ultrasonic pest repelling" — Mosquito, Lizard, Cat, and Rat presets
— framed honestly as a sound experiment, not proven pest control.

## Why this exists / how it's framed

None of the commercial "ultrasonic repellent" frequency ranges are backed by
strong peer-reviewed evidence. Each preset's evidence note in-app says exactly
what is (and isn't) known for that animal — the Lizard preset in particular is
flagged as having no known mechanism at all, since geckos aren't known to sense
ultrasound the way mosquitoes/cats/rodents might.

## Answering "can my phone support this frequency range?"

Android exposes the device's digital audio **sample rate**
(`AudioManager.PROPERTY_OUTPUT_SAMPLE_RATE`), which sets a hard digital ceiling
at half that rate (the Nyquist limit) — but there is **no public API** that
reports a speaker's actual physical frequency response. Most phone speakers
roll off well before that digital ceiling.

So the app does two things:
1. **Reports the digital ceiling** for the connected phone and clamps each
   preset's slider to what's digitally reachable (some phones can't even
   *encode* the top of the Rat preset's typical marketed range).
2. **Provides a manual Sweep test** — ramps the frequency across the selected
   range on a loop so you can listen for where the tone actually fades out on
   your speaker, which is the only reliable way to find a real device's limit.

## Project structure

Standard Gradle/Android Studio layout:

- `app/src/main/java/com/varia/multirepellent/audio/ToneEngine.kt` — live sine
  tone generator built on `AudioTrack`.
- `app/src/main/java/com/varia/multirepellent/audio/DeviceAudioInfo.kt` —
  reads the device's native sample rate.
- `app/src/main/java/com/varia/multirepellent/model/AnimalPreset.kt` — the
  four animal presets and their evidence notes.
- `app/src/main/java/com/varia/multirepellent/ui/` — Compose UI and theme.

## Building and installing on your phone

This was written and reviewed in an environment without the Android SDK, an
emulator, or a physical device attached, so it has **not** been build-verified
end to end — open it in Android Studio (which will fetch the SDK/AGP/Kotlin
automatically) or run the CLI build below on a machine with the Android SDK
installed:

```bash
# with your phone connected over USB and USB debugging enabled
./gradlew installDebug
```

Or open the project root in Android Studio, let it sync, and hit Run with
your phone selected as the deployment target. minSdk is 26 (Android 8.0+).
