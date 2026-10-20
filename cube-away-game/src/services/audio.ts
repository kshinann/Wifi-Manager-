import { createAudioPlayer, AudioPlayer, setAudioModeAsync } from 'expo-audio';

const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  whoosh: require('../../assets/sounds/whoosh.wav'),
  bump: require('../../assets/sounds/bump.wav'),
  hint: require('../../assets/sounds/hint.wav'),
  win: require('../../assets/sounds/win.wav'),
  lose: require('../../assets/sounds/lose.wav'),
};
export type SoundName = keyof typeof SOURCES;

const players: Partial<Record<SoundName, AudioPlayer>> = {};
let enabled = true;

export function setSoundEnabled(on: boolean) {
  enabled = on;
}

export async function initAudio() {
  try {
    await setAudioModeAsync({ playsInSilentMode: false });
    for (const name of Object.keys(SOURCES) as SoundName[]) players[name] = createAudioPlayer(SOURCES[name]);
  } catch {
    // Audio is optional; the game works silently if the platform refuses.
  }
}

export function play(name: SoundName) {
  if (!enabled) return;
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {}
}
