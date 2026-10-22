# Varia Connect

Construction site management app for Malaysian contractors. It is currently a clickable prototype: a web mockup, an Android test app and printable safety templates.

**Before doing anything, read `HANDOFF.md`.** It has the decisions already made, user preferences, the file map, the build and publish steps, and open items.

Key rules:
- Work on branch `ccr-66c8814d-t40nh6` unless told otherwise.
- The user wants clarifying questions (multiple choice, with a recommended option) before you start work. Explain in plain words and attach deliverables (APK, PDF) in chat.
- `mockup/sitelink.html` is the single source for the web mockup and the Android app. `mockup/data/*.js` is the single source for the abbreviation list and the safety templates, both in the app and in the Word/PDF files in `templates/`, which are generated.
- Android builds happen on GitHub Actions (`.github/workflows/android-apk.yml`); this cloud environment can't reach the Android SDK or Maven hosts.
