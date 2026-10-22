# Varia Connect: project handoff

Status as of 22 Oct 2026. Read this first when continuing the work in a new session.

## What this is

**Varia Connect** is a draft construction site management app for Malaysian main contractors. So far it is a **clickable prototype with sample data**: no backend, no login, nothing shared between devices. It exists in three forms, all built from the same HTML file:

| Form | Where |
|---|---|
| Web mockup (single HTML page) | `mockup/sitelink.html`, published at https://claude.ai/artifact/L5MVUihE6ssQJ3gmCj95Dp (private, owner's account) |
| Android test app (WebView wrapper) | `android/`, built by GitHub Actions; latest APK: https://github.com/kshinann/Wifi-Manager-/releases/download/test-build-2/VariaConnect-0.1.0-debug.apk |
| Printable safety templates + abbreviation list | `templates/word/*.docx`, `templates/pdf/*.pdf` (index: `templates/README.md`) |

All work is on branch **`ccr-66c8814d-t40nh6`** of `kshinann/Wifi-Manager-`. Nothing has been merged to `main` and no pull request exists yet.

The repo name is historical: other branches (e.g. `claude/wifi-health-mobile-app-uow0yk`) hold an unrelated Wi-Fi health app with its own `android-build.yml` workflow. Leave those alone.

## Decisions the user made (don't re-ask)

- **Users / roles:** Head office / Client, Site manager, Worker / Subcontractor, Site IT admin. The "Viewing as" switcher shows each one's version.
- **Context:** Malaysia (RM, CIDB, DOSH/JKKP, PDPA, SMM2, PAM 2018, CIPAA), **offline-first**, **multiple sites** (project switcher + head-office portfolio), **mobile-first** (bottom tab bar on phones).
- **Modules:** Overview, Safety, Site operations, Drawings & design, BQ & cost, Materials, **Subcontractors**, Plant & equipment, **Site network (keep it)**, Guide & standards, Feature map.
- **Subcontractors:** register & prequalification, work packages, claims & back-charges, performance rating. Office and site manager see all companies; a subcontractor sees **only its own** (sample company: Bina Acuan Sdn Bhd).
- **Guide & standards:** abbreviation glossary, regulations & standards register, company SOPs, drawing & document codes.
- **Abbreviation list:** full list (now 361 terms), **English + Bahasa Malaysia**.
- **Safety templates:** permits to work, risk assessment, inspections & checklists, reporting forms. Delivered **in the app (fillable) and as Word/PDF**.
- **App name:** "Varia Connect" (user's choice), package ID `my.com.varia.connect`.
- **APK route:** build on **GitHub Actions** (this cloud environment's network blocks dl.google.com, maven.google.com, services.gradle.org and repo.maven.apache.org, so it can't build Android locally).
- **Phone features in the APK:** camera/gallery for hazard photos, GPS pin, real online/offline detection, Android back button.

## User preferences

- **Ask clarifying questions before answering** and confirm all inputs are given. Use multiple-choice questions with a recommended option.
- The user is not a developer: explain in plain words, give direct links, and attach files (APK, PDFs) in chat.

## File map

```
mockup/sitelink.html            The whole app: HTML + CSS + vanilla JS (~1,200 lines). Page body only
                                (no <html>/<head>): the artifact host and the Android app add the skeleton.
mockup/data/glossary.js         window.VC_GLOSSARY = [[abbr, English, Bahasa Malaysia, category], ...]
mockup/data/safety-templates.js window.VC_TEMPLATES = [{id, cat, title, bm, validity, use, sections:[...]}]
                                Section types: fields, yesno, checks, table, signs, matrix, note
android/                        Plain Java WebView app (no Kotlin, no Capacitor). minSdk 26, targetSdk 34, AGP 8.5.2, Gradle 8.9.
  app/src/main/java/my/com/varia/connect/MainActivity.java
                                Serves https://appassets.androidplatform.net/index.html = skeleton + assets/sitelink.html,
                                and /data/*.js from assets. Handles the file chooser (camera via FileProvider),
                                geolocation permission and the back button (calls window.vcBack()).
  app/build.gradle              assets.srcDirs includes ../../mockup, so the APK always ships the current mockup.
                                versionCode = GITHUB_RUN_NUMBER.
  app/debug.keystore            Shared TEST signing key (password "android") so test builds install over each other.
                                Never use it for a Play Store release.
.github/workflows/android-apk.yml
                                On push to android/**, mockup/** or the workflow: builds the debug APK, uploads an
                                artifact and creates a prerelease "test-build-<run number>" with the APK attached.
tools/build-printables.js       Generates templates/word/*.docx from the two data files (npm "docx").
tools/build-printables.sh       Runs the above, converts to PDF with LibreOffice, merges 00_All-Safety-Templates.pdf.
templates/                      Generated Word/PDF output + README index. Rebuild; don't edit by hand.
dist/                           Local downloaded APKs (git-ignored).
```

## How to work on it

- **Edit the app:** change `mockup/sitelink.html` or the data files. Each view is a function `V.<name>()` returning an HTML string; state lives in `S`; sample data in `D`; `render()` redraws. Navigation and roles: `NAV` and `ROLE_NAV`.
- **Check it:** syntax-check the last `<script>` with `node --check`, then click through every role, view and tab with headless Chromium. Playwright is installed globally: `require(\`${npm root -g}/playwright\`)`. Check there's no horizontal scroll at 390px wide.
- **Republish the web mockup:** publish `mockup/sitelink.html` with the Artifact tool to URL https://claude.ai/artifact/L5MVUihE6ssQJ3gmCj95Dp, passing `files: {"data/glossary.js": "mockup/data/glossary.js", "data/safety-templates.js": "mockup/data/safety-templates.js"}`. A new session must **read** that artifact before publishing to it.
- **New APK:** commit and push to the branch. The workflow builds `test-build-N` (about 3 minutes). Poll `https://api.github.com/repos/kshinann/Wifi-Manager-/actions/workflows/android-apk.yml/runs?per_page=1` (the repo is public). Download the APK from the release and attach it in chat.
- **Rebuild printables** after changing the data files: `tools/build-printables.sh`, then commit `templates/`.
- **Commits:** clear messages; no model names in commits or files.

## Open items / next steps

1. **Not yet tested on a real phone.** Waiting for the user's feedback on test build 2 (camera, GPS, offline, back button, forms with signatures).
2. **Branding:** no logo or brand colours yet. Header and launcher icon use a placeholder roof/"A" mark on safety amber `#F2A900`.
3. **Company forms:** offered to match the safety templates to the user's existing permit-to-work and other forms. The user hasn't sent them yet.
4. **Reviews needed:** the SHO should review the safety templates (limits and legal references are typical Malaysian practice), and a native speaker should check the Bahasa Malaysia terms.
5. **Download links in the app** point to `raw/ccr-66c8814d-t40nh6/templates/...`. They break if the branch is deleted, so update `RAW` in `mockup/sitelink.html` after merging to `main`.
6. **Offered, not started:** iPhone/iOS build (needs an Apple Developer account); a Play Store release (needs a private signing key and store listing).
7. **Toward a real product:** backend + login, real data storage and sync (currently in-memory sample data), multi-user approvals, push notifications, bundled fonts for full offline use (Google Fonts currently load from the network).
8. Consider opening a PR to merge this branch into `main` (only when the user asks).
