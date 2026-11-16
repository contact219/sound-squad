// Sound Squad — everything is saved on this device only (localStorage).
import { LEVEL_COUNTS } from './data.js';

const KEY = 'soundsquad.v1';
export const SKILLS = ['ran', 'letters', 'phon', 'spell', 'decode', 'memory', 'fluency', 'write', 'math'];

export const SKILL_INFO = {
  ran: {
    title: 'Speed Warm-Up', emoji: '⚡', color: '#f5b400',
    kid: 'Say them fast, like a cheer count!',
    coach: 'Rapid automatic naming: quickly naming colors, numbers, letters and common words in a row.',
    report: 'Rapid Symbolic Naming (CTOPP-2 Rapid Digit / Letter Naming). Slow naming makes reading choppy.',
  },
  letters: {
    title: 'Mirror Twins', emoji: '🪞', color: '#2b8bd8',
    kid: 'Spot the twin that is flipped!',
    coach: 'Telling look-alike letters, numbers and words apart (b/d, p/q, u/y, 6/9, 12/21, was/saw).',
    report: 'Letter knowledge errors, reversals, and transposing letters and numbers.',
  },
  phon: {
    title: 'Sound Stunts', emoji: '🤸', color: '#e2366b',
    kid: 'Find, count and take away sounds.',
    coach: 'Phonological awareness: hearing the first, middle and last sound, counting sounds, and taking a sound away.',
    report: 'Phonological Awareness (CTOPP-2 Elision and Phoneme Isolation). The root skill for decoding and spelling.',
  },
  spell: {
    title: 'Give Me a Sound!', emoji: '📣', color: '#7a3ff2',
    kid: 'Build the word, then cheer it!',
    coach: 'Spelling by sound: hear a word, build it from sound tiles, then chant it like a spelling cheer.',
    report: 'Spelling (WIAT-4 Spelling): vowel teams, diphthongs, multi-syllable words.',
  },
  decode: {
    title: 'Cheer Names', emoji: '🏷️', color: '#0e9f9a',
    kid: 'Sound out silly squad names!',
    coach: 'Decoding made-up words (so memory can’t help) and breaking long words into syllables.',
    report: 'Pseudoword Decoding and Decoding Fluency (WIAT-4): unfamiliar and multi-syllable words.',
  },
  memory: {
    title: 'Echo Routine', emoji: '🔁', color: '#2aa36b',
    kid: 'Watch, listen, and repeat the routine.',
    coach: 'Working memory: holding a sequence in mind and repeating it forward or backward, using chunking.',
    report: 'Working memory (WISC-V Digit Span, CTOPP-2 Memory for Digits). Affects comprehension, spelling and multi-step math.',
  },
  fluency: {
    title: 'Read & Cheer', emoji: '📖', color: '#ff7a1a',
    kid: 'Listen, echo, then read it yourself!',
    coach: 'Reading fluency and comprehension: phrase-by-phrase reading, echo reading, timed reading (words correct per minute) and questions.',
    report: 'Reading Fluency and Comprehension (GORT-5): main idea, cause and effect.',
  },
  write: {
    title: 'Sentence Builder', emoji: '✏️', color: '#c2410c',
    kid: 'Say it, build it, fix it up!',
    coach: 'Written expression: say a sentence (speech-to-text), rebuild it from word tiles, fix capitals and end marks, then copy it on paper.',
    report: 'Written Expression and Sentence Writing Fluency (WIAT-4): sentences, capitals, punctuation.',
  },
  math: {
    title: 'Math Squad', emoji: '🔢', color: '#4f46e5',
    kid: 'Clocks, word problems and carrying!',
    coach: 'Word problems read aloud with visual steps, carrying and borrowing on a place-value chart, telling time and coins.',
    report: 'Math Problem Solving and Calculation (WIAT-4): read-aloud word problems, step-by-step regrouping.',
  },
};

export const DEFAULT_SETTINGS = {
  font: 'Lexend', size: 26, spacing: 0.06, lineHeight: 1.7, tint: 'cream', rate: 0.85, voiceURI: '',
  routine: 'regular', breaks: true, mic: false, sfx: true, recordReading: false, useCustomWords: false,
};

const blank = () => ({ profiles: [], activeId: null });
let db = load();

// Fill in anything an older saved profile is missing.
function ensure(p) {
  p.settings = { ...DEFAULT_SETTINGS, ...p.settings };
  p.levels = { decode: 1, write: 1, math: 1, ...p.levels };
  const arrays = ['sessions', 'mastered', 'days', 'notes', 'stories', 'quits', 'moods', 'checkpoints', 'readings', 'goals', 'journal', 'watch', 'customWords'];
  for (const a of arrays) if (!Array.isArray(p[a])) p[a] = [];
  const objs = ['recent', 'errors', 'comeback', 'best', 'memSpan', 'readHistory', 'soundStats'];
  for (const o of objs) if (!p[o] || typeof p[o] !== 'object') p[o] = {};
  if (typeof p.stars !== 'number') p.stars = 0;
  return p;
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY)) || blank();
    d.profiles.forEach(ensure);
    return d;
  } catch { return blank(); }
}
export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { console.warn('Could not save', e); }
}
export const all = () => db;
export const profile = () => db.profiles.find(p => p.id === db.activeId) || null;
export function setActive(id) { db.activeId = id; save(); }

export function addProfile({ name, grade, color }) {
  const g = Number(grade) || 3;
  const start = Math.max(1, Math.min(4, Math.floor((g - 1) / 2) + 1));
  const p = ensure({
    id: Math.random().toString(36).slice(2, 10), name: name.trim() || 'Reader', grade: g, color: color || '#e2366b',
    created: Date.now(), settings: { ...DEFAULT_SETTINGS },
    levels: { ran: 1, letters: 1, phon: start, spell: start, decode: 1, memory: 1, fluency: start, write: 1, math: 1 },
  });
  db.profiles.push(p);
  db.activeId = p.id;
  save();
  return p;
}

export function deleteProfile(id) {
  db.profiles = db.profiles.filter(p => p.id !== id);
  if (db.activeId === id) db.activeId = db.profiles[0]?.id || null;
  save();
}

export function updateSettings(patch) { Object.assign(profile().settings, patch); save(); }

export const today = (t = Date.now()) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export function streak(p = profile()) {
  const days = new Set(p.days);
  let n = 0;
  const d = new Date();
  if (!days.has(today(d))) d.setDate(d.getDate() - 1); // today not done yet: count from yesterday
  while (days.has(today(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function noteError(kind, key) {
  const p = profile();
  const k = `${kind}:${key}`;
  p.errors[k] = (p.errors[k] || 0) + 1;
  save();
}

// Per-sound accuracy, used for the sound map and for choosing practice words.
export function soundStat(key, ok, p = profile()) {
  const s = (p.soundStats[key] = p.soundStats[key] || { h: 0, m: 0 });
  if (ok) s.h++; else s.m++;
  save();
}
export function soundAccuracy(p, key) {
  const s = p.soundStats[key];
  if (!s || s.h + s.m < 3) return null;
  return s.h / (s.h + s.m);
}
export function focusSounds(p) {
  const weak = Object.keys(p.soundStats).filter(k => (soundAccuracy(p, k) ?? 1) < 0.7);
  return [...new Set([...p.watch, ...weak])];
}

// Missed spelling words come back later until spelled right on the first try twice.
export function comebackMiss(spec) { const p = profile(); p.comeback[spec] = 0; save(); }
export function comebackHit(spec) {
  const p = profile();
  if (!(spec in p.comeback)) return false;
  p.comeback[spec]++;
  if (p.comeback[spec] >= 2) {
    delete p.comeback[spec];
    if (!p.mastered.includes(spec)) p.mastered.push(spec);
    save();
    return true;
  }
  save();
  return false;
}

// Decide if a skill should move up or down a level. Returns +1, -1 or 0.
function adapt(p, skill, s) {
  if (skill === 'fluency' && (!s.items || s.details?.level !== p.levels.fluency)) return 0; // own stories, other levels
  const r = (p.recent[skill] = [...(p.recent[skill] || []), s].slice(-3));
  const acc = x => (x.items ? x.correct / x.items : 0);
  const max = LEVEL_COUNTS[skill];
  const lvl = p.levels[skill];
  const last2 = r.slice(-2);
  let up = false;
  let down = false;
  if (skill === 'ran') {
    up = last2.length === 2 && last2.every(x => x.metric >= 45);
  } else if (skill === 'memory') {
    const need = lvl >= 3 ? 4 : 5;
    up = last2.length === 2 && last2.every(x => x.metric >= need);
  } else if (skill === 'fluency') {
    up = last2.length === 2 && last2.every(x => acc(x) >= 0.66 && (x.details?.accuracy ?? 1) >= 0.95);
    down = acc(s) < 0.34 && (s.details?.accuracy ?? 1) < 0.85;
  } else {
    up = last2.length === 2 && last2.every(x => acc(x) >= 0.8);
    down = acc(s) < 0.4;
  }
  if (up && lvl < max) { p.levels[skill] = lvl + 1; p.recent[skill] = []; return 1; }
  if (down && lvl > 1) { p.levels[skill] = lvl - 1; p.recent[skill] = []; return -1; }
  return 0;
}

export function recordSession(skill, result) {
  const p = profile();
  const s = {
    t: Date.now(), skill, level: p.levels[skill], items: result.items || 0, correct: result.correct || 0,
    ms: result.ms || 0, metric: result.metric ?? null, details: result.details || null,
  };
  p.sessions.push(s);
  if (!p.days.includes(today())) p.days.push(today());
  p.stars += Math.max(1, s.correct); // showing up always earns a point
  const change = adapt(p, skill, s);
  save();
  return { session: s, change };
}

export function logQuit(skill, ms) {
  const p = profile();
  p.quits.push({ t: Date.now(), skill, ms });
  save();
}
export function addMood(mood) { const p = profile(); p.moods.push({ t: Date.now(), mood }); save(); }

export function personalBest(key, value, higherIsBetter = true) {
  const p = profile();
  const old = p.best[key];
  const better = old == null || (higherIsBetter ? value > old : value < old);
  if (better) { p.best[key] = value; save(); }
  return { old, better };
}

// ---------- Goals ----------
export const GOAL_MEASURES = {
  read_wcpm: { label: 'Read & Cheer: words correct per minute', unit: 'words/min' },
  cp_words: { label: 'Checkpoint: real words per minute', unit: 'words/min' },
  cp_nonwords: { label: 'Checkpoint: made-up words per minute', unit: 'words/min' },
  cp_sounds: { label: 'Checkpoint: letter sounds correct', unit: 'sounds' },
  cp_spell: { label: 'Checkpoint: spelling words correct (of 10)', unit: 'words' },
  cp_read: { label: 'Checkpoint: story words correct per minute', unit: 'words/min' },
  ran: { label: 'Speed Warm-Up: items per minute', unit: '/min' },
  memory: { label: 'Echo Routine: longest routine', unit: 'items' },
  days_week: { label: 'Practice days in the last 7 days', unit: 'days' },
  mastered: { label: 'Mastered spelling words', unit: 'words' },
  custom: { label: 'Other (check it off yourself)', unit: '' },
};

export function measureNow(p, m) {
  const last = arr => arr[arr.length - 1];
  const sess = sk => p.sessions.filter(s => s.skill === sk && s.metric != null);
  const cp = last(p.checkpoints);
  switch (m) {
    case 'read_wcpm': return last(sess('fluency'))?.metric ?? null;
    case 'ran': return last(sess('ran'))?.metric ?? null;
    case 'memory': return last(sess('memory'))?.metric ?? null;
    case 'cp_words': return cp?.words?.rate ?? null;
    case 'cp_nonwords': return cp?.nonwords?.rate ?? null;
    case 'cp_sounds': return cp?.sounds?.correct ?? null;
    case 'cp_spell': return cp?.spelling?.correct ?? null;
    case 'cp_read': return cp?.reading?.wcpm ?? null;
    case 'days_week': {
      const weekAgo = Date.now() - 7 * 864e5;
      return p.days.filter(d => new Date(d + 'T12:00:00').getTime() >= weekAgo).length;
    }
    case 'mastered': return p.mastered.length;
    default: return null;
  }
}

export function replaceAll(data) {
  if (!data || !Array.isArray(data.profiles)) throw new Error('This file is not a Sound Squad backup.');
  data.profiles.forEach(ensure);
  db = data;
  save();
}
