# Trial: English → Mandarin (free, built-in AI)

The trial does one thing: an **English speaker** talks into the PC's microphone, and the **Mandarin** translation goes to:

1. **A web room**, where listeners on the same Wi-Fi get Mandarin captions and voice on their phone or laptop.
2. **Another meeting** (Zoom, Teams or Google Meet), where the Mandarin voice becomes that meeting's microphone through VB-Cable.

No API key is needed.

**This trial is set up for a PC without a graphics card (CPU only).** It uses the *small* Whisper model and shorter speech chunks, so expect the Mandarin about **3–6 seconds after each sentence**. The self-check (`trial-check.bat`) tells you the delay measured on your PC. When you add an NVIDIA GPU later, the same app becomes about 1–3 s and more accurate. See *Adding a GPU later* below.

---

## A. One-time setup (about 20 minutes, mostly downloads)

1. **Python:** install Python 3.11 from <https://www.python.org/downloads/windows/>. On the first installer screen, tick **"Add python.exe to PATH"**.
2. **VB-Cable** (only needed for sending Mandarin into a meeting): download *VBCABLE_Driver_Pack* from <https://vb-audio.com/Cable/>, unzip it, right-click `VBCABLE_Setup_x64.exe` → **Run as administrator** → Install, then **restart the PC**.
3. Unzip this trial folder somewhere simple, such as `C:\LiveTranslator`.
4. Double-click **`install.bat`** and wait until it says *Done*.
5. Double-click **`trial-check.bat`**. The first time, it downloads the AI models (about 1–3 GB). It then checks your GPU, microphone and VB-Cable, translates a test sentence, and **plays it in Mandarin** on your speakers. Wait for **ALL GOOD**.

## B. For each meeting

1. Plug in the **English speaker's microphone** and set it as the default in Windows (Settings → System → Sound → Input).
2. Double-click **`trial-start.bat`**. The control panel opens in the browser. Press **Start** and wait for `running`.
   - The log should show `Mandarin voice → sound output 'CABLE Input'`.
3. **Mandarin meeting (Zoom, Teams or Meet):** join the meeting on this PC and set its **Microphone = CABLE Output (VB-Audio Virtual Cable)**.
   - Zoom: ^ next to Mute → choose the microphone. Also turn off *Automatically adjust microphone volume* and set *Background noise suppression* to Low.
   - Teams: ⋯ → Settings → Devices → Microphone. Set *Noise suppression* to Low.
   - Google Meet (Chrome): ⋮ → Settings → Audio → Microphone. No developer key is needed.
   - Mute this PC's *speaker* in that meeting, or use headphones, so the Mandarin room's audio doesn't feed back into the English mic.
4. **Phones and laptops:** the control panel's Status box shows a link like `http://192.168.1.20:8000/rooms`. Share it as a QR code or in chat. Listeners pick **Mandarin**, then tap **🔊**.
5. Press **Test** on the Mandarin channel to hear a sample sentence in the meeting or room before the speaker starts.
6. When finished, press **Stop**. Use **Transcript** to download the English + Mandarin text.

## Tips

- The speaker should pause briefly between sentences. Each pause sends the sentence for translation.
- If the level bar moves but nothing translates, lower *Minimum loudness* in Settings (e.g. 0.004). If background noise triggers it, raise it (e.g. 0.015).
- If Windows asks to allow Python through the firewall, allow it on **Private networks** so phones can reach the web room.
- For English that comes *from another meeting* (rather than a room mic), see *Recipe A* in `README.md`. That needs a second virtual cable.

## CPU tips (until the GPU arrives)

- Use a PC with a recent **Intel Core i5/i7 or AMD Ryzen 5/7** (or better) and **16 GB RAM**. Plug in the laptop charger and choose the Windows power mode **Best performance**.
- Close other heavy programs. The meeting app on the same PC is fine.
- If the self-check says the delay is over 6 s, set *Whisper model* to **base** in the control panel. It's faster, but slightly less accurate with accents and names.
- Put company names and terms in the **Glossary** later, when you move to an AI API key. The free built-in translator doesn't use the glossary.

## Adding a GPU later

1. Install the NVIDIA card and its **latest driver** from <https://www.nvidia.com/drivers>, then restart.
2. Double-click **`upgrade-to-gpu.bat`** (about 3 GB of downloads).
3. Run **`trial-check.bat`**. It should show `GPU: <your card>`, download the larger Whisper model, and report a delay of about 1–3 s.

Nothing else changes: your settings, routes and links stay the same. If the GPU ever fails to load, the app falls back to the CPU on its own, so the meeting keeps going. A card with **8 GB or more of video memory** (e.g. RTX 3060 12 GB, RTX 4060 Ti 16 GB or newer) runs everything comfortably.

## If something goes wrong

| Problem | Fix |
|---|---|
| `install.bat` says *python is not recognized* | Reinstall Python with **Add to PATH** ticked. |
| Log says `'CABLE Input' not found` | VB-Cable isn't installed, or the PC hasn't restarted since. The web room still works. |
| No sound in the web room | Tap 🔊 (phones need a tap to allow audio). Make sure the phone is on the same Wi-Fi. |
| Phone can't open the link | Allow Python in Windows Firewall (Private networks), and check that the Wi-Fi doesn't isolate clients (guest networks often do). |
| Very slow on CPU | In AI engines, set *Whisper model* to **base**, and set the Windows power mode to Best performance. |
| After adding a GPU, the self-check still says "none" | Update the NVIDIA driver, restart, and run `upgrade-to-gpu.bat` again. |
| No Mandarin voice at all | The free Edge voice needs internet. Check that the PC is online. |

Send the text in the black window (or a screenshot) to the developer if you need help.
