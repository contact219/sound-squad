// Voice: text-to-speech, grown-up voice recordings, speech recognition and sound effects.
import { SOUNDS, spellOut } from './data.js';

let settings = { rate: 0.85, voiceURI: '', sfx: true };
export function configure(s) { settings = { ...settings, ...s }; }

const synth = window.speechSynthesis;
export const ttsSupported = !!synth;

export function voices() {
  return (synth?.getVoices() || []).filter(v => /^en/i.test(v.lang));
}
function chooseVoice() {
  const list = voices();
  return list.find(v => v.voiceURI === settings.voiceURI)
    || list.find(v => /natural|neural|enhanced|premium/i.test(v.name) && /en-US/i.test(v.lang))
    || list.find(v => /Samantha|Google US English|Aria|Jenny|Zira/i.test(v.name))
    || list.find(v => /en-US/i.test(v.lang)) || list[0] || null;
}
if (synth) synth.onvoiceschanged = () => {};

let speakToken = 0;
export function stop() {
  speakToken++;
  synth?.cancel();
  if (currentAudio) { currentAudio.pause(); currentAudio = null; }
  document.querySelectorAll('.video-bubble video').forEach(v => { v.pause(); v.dispatchEvent(new Event('ended')); });
}

// Speak text; resolves when finished (with a time-based fallback, since some browsers skip "end").
export function say(text, { rate } = {}) {
  if (!synth || !text) return Promise.resolve();
  const token = ++speakToken;
  synth.cancel();
  return new Promise(resolve => {
    const u = new SpeechSynthesisUtterance(text);
    const v = chooseVoice();
    if (v) u.voice = v;
    u.lang = v?.lang || 'en-US';
    u.rate = rate ?? settings.rate;
    let done = false;
    const finish = () => { if (!done) { done = true; clearTimeout(timer); resolve(token === speakToken); } };
    u.onend = finish;
    u.onerror = finish;
    const timer = setTimeout(finish, 1500 + text.length * 110 / (u.rate || 1));
    // Chrome sometimes drops an utterance spoken immediately after cancel().
    setTimeout(() => synth.speak(u), 30);
  });
}

// ---------- Grown-up voice clips (IndexedDB) ----------
let dbp;
function idb() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open('soundsquad', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('clips');
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbp;
}
async function tx(mode, fn) {
  const d = await idb();
  return new Promise((resolve, reject) => {
    const t = d.transaction('clips', mode);
    const req = fn(t.objectStore('clips'));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}
export const getClip = key => tx('readonly', s => s.get(key)).catch(() => null);
export const putClip = (key, blob) => tx('readwrite', s => s.put(blob, key));
export const deleteClip = key => tx('readwrite', s => s.delete(key));
export const clipKeys = () => tx('readonly', s => s.getAllKeys()).catch(() => []);

let currentAudio = null;
export async function playBlob(blob) {
  const token = ++speakToken;
  synth?.cancel();
  const url = URL.createObjectURL(blob);
  const a = new Audio(url);
  currentAudio = a;
  await new Promise(resolve => {
    a.onended = a.onerror = resolve;
    a.play().catch(resolve);
  });
  URL.revokeObjectURL(url);
  return token === speakToken;
}

// Say a sound tile: the grown-up's video or voice recording if there is one, otherwise "letters, as in keyword".
export async function sayTile(tile) {
  const video = await getClip(`video:sound:${tile.key}`);
  if (video) return playVideoBubble(video);
  const clip = await getClip(`sound:${tile.key}`);
  if (clip) return playBlob(clip);
  return say(tileText(tile));
}

// Play a video clip in a small floating bubble (e.g. a grown-up's mouth making a sound).
export async function playVideoBubble(blob, { big = false } = {}) {
  const token = ++speakToken;
  synth?.cancel();
  document.querySelectorAll('.video-bubble').forEach(b => b.remove());
  const box = document.createElement('div');
  box.className = 'video-bubble' + (big ? ' big' : '');
  const v = document.createElement('video');
  v.playsInline = true;
  v.src = URL.createObjectURL(blob);
  box.appendChild(v);
  document.body.appendChild(box);
  await new Promise(resolve => {
    v.onended = v.onerror = resolve;
    box.onclick = resolve;
    v.play().catch(resolve);
  });
  URL.revokeObjectURL(v.src);
  box.remove();
  return token === speakToken;
}
export function tileText(tile) {
  if (tile.silent) return 'silent e';
  const s = SOUNDS[tile.key];
  if (!s) return spellOut(tile.label);
  return `${spellOut(tile.label)}, as in ${s[0]}`;
}

// Start recording. Returns a stop() function that resolves with the Blob.
// With { video: <video element> } it records the front camera too and shows a live preview.
export async function record({ video } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia(video
    ? { audio: true, video: { facingMode: 'user', width: { ideal: 480 }, height: { ideal: 480 } } }
    : { audio: true });
  if (video) { video.srcObject = stream; video.muted = true; video.playsInline = true; video.play().catch(() => {}); }
  const rec = new MediaRecorder(stream);
  const chunks = [];
  rec.ondataavailable = e => chunks.push(e.data);
  rec.start();
  return () => new Promise(resolve => {
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (video) video.srcObject = null;
      resolve(new Blob(chunks, { type: rec.mimeType || (video ? 'video/webm' : 'audio/webm') }));
    };
    rec.stop();
  });
}

// ---------- Speech recognition (optional reading check) ----------
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
export const recognitionSupported = !!SR;

export function listen(onText) {
  if (!SR) return () => {};
  let finals = '';
  let stopped = false;
  let rec;
  const start = () => {
    rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finals += ' ' + e.results[i][0].transcript;
        else interim += ' ' + e.results[i][0].transcript;
      }
      onText(finals + ' ' + interim);
    };
    rec.onend = () => { if (!stopped) { try { start(); } catch { /* ignore */ } } };
    rec.onerror = e => { if (e.error === 'not-allowed') stopped = true; };
    rec.start();
  };
  try { start(); } catch { return () => {}; }
  return () => { stopped = true; try { rec.stop(); } catch { /* ignore */ } };
}

// Listen for one spoken sentence. Resolves with the text ('' if nothing was heard).
export function listenOnce({ timeout = 12000 } = {}) {
  return new Promise(resolve => {
    if (!SR) return resolve('');
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.continuous = false;
    let text = '';
    const t = setTimeout(() => { try { rec.stop(); } catch { /* ignore */ } }, timeout);
    rec.onresult = e => { text = [...e.results].map(r => r[0].transcript).join(' '); };
    rec.onend = () => { clearTimeout(t); resolve(text.trim()); };
    rec.onerror = () => {};
    try { rec.start(); } catch { clearTimeout(t); resolve(''); }
  });
}

// ---------- Sound effects (made with WebAudio, no files) ----------
let ac;
function ctx() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
  return ac;
}
export function sfx(name) {
  if (!settings.sfx) return;
  try {
    const a = ctx();
    const t = a.currentTime;
    if (name === 'clap') {
      for (let k = 0; k < 2; k++) {
        const len = 0.12;
        const buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 4);
        const src = a.createBufferSource();
        src.buffer = buf;
        const f = a.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 1400;
        const g = a.createGain(); g.gain.value = 0.7;
        src.connect(f).connect(g).connect(a.destination);
        src.start(t + k * 0.11);
      }
      return;
    }
    const notes = { ding: [880, 1320], up: [523, 659, 784, 1046], soft: [330], tap: [660] }[name] || [660];
    notes.forEach((hz, i) => {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = name === 'soft' ? 'sine' : 'triangle';
      o.frequency.value = hz;
      const st = t + i * 0.09;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(name === 'soft' ? 0.08 : 0.18, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.25);
      o.connect(g).connect(a.destination);
      o.start(st);
      o.stop(st + 0.3);
    });
  } catch { /* audio not available */ }
}
