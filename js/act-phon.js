// Sound Stunts — phonological awareness (first / last / middle sound, counting sounds, taking a sound away).
import { SPELL_LEVELS, PHON_LEVELS, ELISION, phonKey, sounding } from './data.js';
import { say, stop, sfx } from './speech.js';
import { esc, pick, sample, shuffle, waitClick, wiggle, sleep, PRAISE, ENCOURAGE } from './ui.js';
import { noteError } from './store.js';

const COUNT = 6;

function pool(level) {
  const lv = Math.min(SPELL_LEVELS.length, Math.max(4, level + 2));
  return SPELL_LEVELS.slice(0, lv).flatMap(l => l.words).filter(w => !w.syl.length);
}

function positionKey(w, pos) {
  const s = sounding(w);
  const t = pos === 'first' ? s[0] : pos === 'last' ? s[s.length - 1] : s[1];
  return phonKey(t.key);
}

const PROMPT = {
  first: w => `Which word starts with the same sound as ${w}?`,
  last: w => `Which word ends with the same sound as ${w}?`,
  middle: w => `Which word has the same middle sound as ${w}?`,
};

function buildMatch(type, words) {
  const candidates = type === 'middle' ? words.filter(w => sounding(w).length === 3) : words;
  for (let tries = 0; tries < 60; tries++) {
    const target = pick(candidates);
    const key = positionKey(target, type);
    const same = candidates.filter(w => w.word !== target.word && positionKey(w, type) === key);
    const diff = candidates.filter(w => positionKey(w, type) !== key);
    if (!same.length || diff.length < 2) continue;
    const answer = pick(same);
    const opts = shuffle([answer, ...sample(diff, 2)]);
    return { type, target: target.word, prompt: PROMPT[type](target.word), options: opts.map(o => o.word), answer: answer.word, explain: { target, answer } };
  }
  return null;
}

function buildCount(words) {
  const w = pick(words.filter(x => sounding(x).length >= 2 && sounding(x).length <= 5));
  const n = sounding(w).length;
  const opts = [...new Set([n, n - 1, n + 1, n + 2].filter(x => x >= 1))].slice(0, 3).sort((a, b) => a - b);
  return { type: 'count', target: w.word, prompt: `How many sounds do you hear in ${w.word}?`, options: opts.map(String), answer: String(n), explain: { target: w } };
}

function buildElide(where) {
  const [word, ans, distract] = pick(ELISION[where]);
  const label = where === 'first' ? 'the first sound' : where === 'last' ? 'the last sound' : 'the second sound';
  return { type: 'elide' + where, target: word, prompt: `Say ${word}. Now say ${word}, but take away ${label}. What word is left?`, options: shuffle([ans, ...distract]), answer: ans };
}

function build(type, words) {
  if (type === 'count') return buildCount(words);
  if (type === 'elideFirst') return buildElide('first');
  if (type === 'elideLast') return buildElide('last');
  if (type === 'elideMiddle') return buildElide('middle');
  return buildMatch(type, words) || buildCount(words);
}

function boxes(w) {
  return `<div class="boxes">${sounding(w).map(t => `<span>${esc(t.label)}</span>`).join('')}</div>`;
}

export async function run(ctx) {
  const { root, level } = ctx;
  const types = PHON_LEVELS[level - 1].types;
  const words = pool(level);
  let correct = 0;

  for (let q = 0; q < COUNT; q++) {
    const item = build(types[q % types.length], words);
    const isCount = item.type === 'count';
    root.innerHTML = `
      <div class="stage">
        <p class="step">Stunt ${q + 1} of ${COUNT}</p>
        <button class="target big-word" data-say="${esc(item.target)}">🔊 ${esc(item.target)}</button>
        <p class="prompt">${esc(item.prompt)}</p>
        <div class="options ${isCount ? 'count' : ''}">
          ${item.options.map(o => `
            <div class="option" data-choice="${esc(o)}">
              <span class="opt-text">${esc(o)}</span>
              ${isCount ? '' : `<button class="ear" data-say="${esc(o)}" aria-label="Hear ${esc(o)}">🔊</button>`}
            </div>`).join('')}
        </div>
        <div class="explain"></div>
      </div>`;
    root.onclick = e => {
      const s = e.target.closest('[data-say]');
      if (s) { e.stopImmediatePropagation(); say(s.dataset.say); }
    };
    await say(item.prompt);
    if (!ctx.alive()) return null;
    if (!isCount) {
      for (const o of item.options) { if (!(await say(o))) break; await sleep(150); }
    }

    let tries = 0;
    for (;;) {
      const el = await waitClick(root, '[data-choice]');
      if (!ctx.alive()) return null;
      stop();
      if (el.dataset.choice === item.answer) {
        el.classList.add('right');
        sfx('ding');
        if (tries === 0) correct++;
        const ex = root.querySelector('.explain');
        if (isCount) ex.innerHTML = boxes(item.explain.target);
        await say(pick(PRAISE));
        break;
      }
      tries++;
      wiggle(el);
      sfx('soft');
      noteError('phon', item.type);
      await say(`${pick(ENCOURAGE)} ${item.prompt}`);
      if (!ctx.alive()) return null;
    }
    await sleep(500);
    if (!ctx.alive()) return null;
  }
  root.onclick = null;
  return { items: COUNT, correct };
}
