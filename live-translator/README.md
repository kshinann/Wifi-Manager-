# Live Translator

Real-time speech translation for meetings, halls and radio.
It listens to a speaker, turns the speech into text, translates it (**English → Mandarin** first, plus Malay, Tamil and others), and then:

- shows **live captions** in a web room that listeners open on their phone or laptop, and as a caption overlay for screens or OBS;
- **speaks the translation** into any audio output, such as another room's Zoom, Teams or Google Meet (through a virtual cable), a radio transmitter's line-in, or speakers.

```
 INPUT (route)                    AI PIPELINE                         OUTPUTS (channels)
 ─────────────                    ───────────                         ──────────────────
 Room mic / line-in  ┐                                          ┌──▶ Web room  /room/<id>   (phones, laptops)
 Zoom/Teams/Meet     ├──▶ voice detect ─▶ speech→text ─▶ translate ─▶ text→speech ─┼──▶ VB-Cable → mic of the other meeting
  audio via VB-Cable │     (pauses)      Whisper/OpenAI   NLLB/Claude/GPT  Edge/Windows/OpenAI ├──▶ Sound card → radio transmitter
 Phone/browser mic   ┘                                          └──▶ Caption overlay /overlay/<id> (OBS, screen share)
```

## 1. Install (Windows)

1. Install **Python 3.10 or newer** from python.org, and tick *"Add python.exe to PATH"*.
2. Double-click **`install.bat`**. It creates `.venv`, installs everything, and picks the GPU (CUDA) or CPU build of PyTorch automatically.
3. Optional: install **[VB-Audio Virtual Cable](https://vb-audio.com/Cable/)** (free) if you want to send the translated voice into Zoom, Teams or Meet. For more than one language channel, the *VB-Cable A+B* or *Voicemeeter* bundles give you extra virtual cables.
4. Double-click **`start.bat`**. The control panel opens at `http://localhost:8000`.

The first **Start** downloads the built-in AI models (about 1–3 GB), so let it finish once while you have a good connection.

## 2. AI engines: built-in or API key

Choose each stage under **AI engines** in the control panel. You can mix them.

| Stage | Built-in (free, runs on this PC) | With an API key (faster or better) |
|---|---|---|
| Speech → text | **Whisper** (faster-whisper). Auto mode uses `large-v3-turbo` on an NVIDIA GPU and `small` on a CPU | OpenAI (`whisper-1`) |
| Translation | **Meta NLLB-200** (offline) | **Anthropic Claude** (default `claude-opus-5-5`, effort `low`), or OpenAI GPT |
| Text → speech | **Edge neural voices**: free, needs internet, excellent Mandarin `zh-CN-XiaoxiaoNeural`; or **Windows voices**, fully offline | OpenAI TTS |

- **GPU or CPU:** *Processor = Auto* detects an NVIDIA GPU. Expect roughly 1–3 s of delay on a GPU and 3–6 s on a CPU. You can force GPU or CPU.
- **API keys** are saved only on this PC, in `data/config.json`, which is never committed. You can also set them with the `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variables.
- **Claude** uses Anthropic's server-side fallback: if a segment is declined, the API retries it on a recommended fallback model within the same call. Raise *Claude effort* for harder content. You can switch to a faster or cheaper model, such as `claude-haiku-5-5`, in the *Claude model* box.
- **Glossary:** add company names and terms (`board meeting = 董事会会议`) so the AI translators keep them consistent.
- **Offline Mandarin voice:** for Windows voices, add the *Chinese (Simplified)* speech pack under Windows Settings → Time & Language → Speech.

## 3. Routes and channels

- A **route** is one input in one spoken language: a room mic, a meeting's audio, a radio line-in, or a browser or phone mic. Set the speaker language to *Auto-detect* for mixed speakers.
- A **channel** is one target language. Each channel can:
  - publish to a **web room** (`/room/<id>`). Listeners on the same Wi-Fi open `http://<PC-IP>:8000/rooms`, pick a language, and tap 🔊 for audio;
  - **speak out of** one or more sound outputs (Ctrl+click to choose several);
  - feed a **caption overlay** (`/overlay/<id>`), and offer a **transcript** download.

Use **Test** on a channel to hear a sample sentence and check the routing before the meeting.

## 4. Recipes

### A. Translate a Zoom, Teams or Google Meet meeting into another room's meeting
On the PC running the app:

1. In **meeting 1** (the source), set *Speaker* = **CABLE Input**. The app now hears everything said in that meeting.
   > To keep hearing it yourself, open Windows Sound → Recording → *CABLE Output* → Listen → "Listen to this device".
2. In the app, create a route with input = **CABLE Output** and speaker language = English. Add a channel *Mandarin* that speaks out of **CABLE-A Input** (a second virtual cable).
3. In **meeting 2** (the Mandarin room), set *Microphone* = **CABLE-A Output**. The translated Mandarin voice is now the microphone in that meeting.
4. Optional: share `/overlay/<channel>?solid=1` in meeting 2 for subtitles.

This works the same way in Zoom, Teams and Google Meet, because they all let you choose the speaker and microphone device. **Google Meet needs no developer key** this way: open Meet in Chrome and pick the devices under ⋮ → Settings → Audio.

### B. Two-way: English room ↔ Mandarin room
Make two routes: route 1 (input = room A mic or meeting A audio, English) → channel *zh* speaks into room B; route 2 (input = room B, Mandarin) → channel *en* speaks into room A. Use separate virtual cables for each direction so the app doesn't translate its own voice.

### C. Radio, PA or interpretation receivers
Set a channel's output to the sound card (or USB audio interface) whose **line out** is connected to the radio transmitter, FM interpretation system or PA mixer. Each language channel can use its own output, giving one radio frequency per language. The input can be a live mixer feed through line-in.

### D. Live hall: listeners use their own phones
Speaker mic → route input. Listeners scan a QR code of `http://<PC-IP>:8000/rooms` and pick 中文 or Bahasa Melayu. They get captions plus audio in the browser, with no app to install.

### E. Phone as the speaker's microphone
Set the route's input type to *Browser or phone mic* and open `/speak/<route-id>` on the speaker's device. Browsers allow the microphone only on `https://` or `localhost`, so to use a phone over Wi-Fi, start the app with a certificate:

```
start.bat --ssl-certfile cert.pem --ssl-keyfile key.pem
```

A self-signed certificate is enough, for example one made with [mkcert](https://github.com/FiloSottile/mkcert). Also set an **Admin token** in Settings and open `/speak/<route-id>?token=<token>`.

## 5. Security

- The control panel and its API work only from the PC itself, unless you set an **Admin token**. In that case open `http://<PC-IP>:8000/?token=<token>`.
- Listener rooms are open to anyone on the network, by design. Run it on a private or meeting Wi-Fi.

## 6. Native meeting bots (later)

This app works with every platform through audio devices, so it needs no vendor approval. Bots that join a meeting by link and need no extra PC are possible as a next step, but each one needs credentials:

- **Zoom:** a Zoom Meeting SDK app (Client ID and Secret) from marketplace.zoom.us.
- **Microsoft Teams:** an Azure Bot registration with a Graph Communications calling bot (application-hosted media, Windows Server) plus a tenant admin's consent.
- **Google Meet:** the Meet Media API, which needs a Google Cloud project, OAuth credentials and Google's developer-preview enrollment.

## 7. Development

```
pip install -r requirements.txt
python -m unittest discover -s tests     # uses fake engines; no models or sound card needed
python run.py --no-browser
```

Code map: `translator/segmenter.py` (voice detection) · `engines/` (ASR, translation, TTS) · `pipeline.py` (routes and channels) · `audio_devices.py` (sound cards) · `hub.py` (WebSocket fan-out) · `server.py` (web and API) · `static/` (control panel, rooms, overlay, speaker mic).
