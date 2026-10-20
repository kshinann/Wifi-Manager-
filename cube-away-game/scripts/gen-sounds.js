// Synthesises the game's small sound effects as 16-bit mono WAV files (no external assets needed).
const fs = require('fs');
const path = require('path');

const RATE = 22050;
const out = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(out, { recursive: true });

function wav(name, seconds, fn) {
  const n = Math.floor(seconds * RATE);
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / RATE;
    const v = Math.max(-1, Math.min(1, fn(t, t / seconds, noise)));
    buf.writeInt16LE(Math.round(v * 32767 * 0.8), 44 + i * 2);
  }
  fs.writeFileSync(path.join(out, name), buf);
}

const sine = (f, t) => Math.sin(2 * Math.PI * f * t);
const env = (p, attack = 0.02) => Math.min(1, p / attack) * (1 - p) ** 2;

wav('tap.wav', 0.08, (t, p) => sine(1200 - 600 * p, t) * env(p, 0.05));
wav('whoosh.wav', 0.35, (t, p, noise) => (noise() * 0.5 + sine(300 + 900 * p, t) * 0.3) * Math.sin(Math.PI * p));
wav('bump.wav', 0.22, (t, p, noise) => (sine(110 - 40 * p, t) + noise() * 0.25) * env(p, 0.01));
wav('hint.wav', 0.5, (t, p) => (sine(880, t) * 0.6 + sine(1320, t) * 0.4) * env(p, 0.02));
wav('win.wav', 1.1, (t, p) => {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  const k = Math.min(3, Math.floor(p * 5));
  const local = (p * 5 - k) / (k === 3 ? 2 : 1);
  return sine(notes[k], t) * 0.7 * Math.min(1, local * 20) * (k === 3 ? 1 - p : 1);
});
wav('lose.wav', 0.9, (t, p) => sine(392 - 200 * p, t) * 0.7 * env(p, 0.03));
console.log('sounds written to', out);
