// Mirror Twins — find every target among its look-alike twins.
import { TWIN_LEVELS, CHEER_MOVES, LETTER_NAMES } from './data.js';
import { say, stop, sfx, getClip, playVideoBubble } from './speech.js';
import { esc, shuffle, sample, waitClick, wiggle, sleep, PRAISE } from './ui.js';
import { noteError } from './store.js';

const ROUNDS = 3;
const isNum = s => /^\d+$/.test(s);
const isWord = s => s.length > 1 && !isNum(s);
const spoken = s => (s.length === 1 && LETTER_NAMES[s]) ? LETTER_NAMES[s] : s;

function moveFor(a, b) {
  if ((a === 'b' && b === 'd') || (a === 'd' && b === 'b')) return CHEER_MOVES.bd;
  if (isNum(a) && a.length > 1) return CHEER_MOVES.num;
  if (isWord(a)) return CHEER_MOVES.word;
  return null;
}

export async function run(ctx) {
  const { root, level } = ctx;
  const lvl = TWIN_LEVELS[level - 1];
  const size = level <= 2 ? 12 : 16;
  const shown = new Set();
  let found = 0;
  let wrong = 0;

  const pairs = lvl.pairs.length >= ROUNDS ? sample(lvl.pairs, ROUNDS) : Array.from({ length: ROUNDS }, (_, i) => lvl.pairs[i % lvl.pairs.length]);
  for (let r = 0; r < ROUNDS; r++) {
    const [x, y] = shuffle(pairs[r]);
    const target = x;
    const twin = y;

    // Teach the cheer move the first time this pair shows up.
    const pairKey = [x, y].sort().join('/');
    if (!shown.has(pairKey)) {
      shown.add(pairKey);
      const extra = moveFor(x, y);
      root.innerHTML = `
        <div class="stage">
          <p class="step">Cheer move</p>
          <div class="twins">
            ${[x, y].map(c => `<div class="twin"><div class="glyph">${esc(c)}</div><p>${esc(CHEER_MOVES[c] || '')}</p></div>`).join('')}
          </div>
          ${extra ? `<p class="move">${esc(extra)}</p>` : ''}
          <button class="btn primary" data-go>Got it!</button>
        </div>`;
      const lines = [x, y].map(c => CHEER_MOVES[c]).filter(Boolean).join(' ');
      const video = await getClip(`video:move:${pairKey}`);
      if (video) {
        root.querySelector('[data-go]').insertAdjacentHTML('beforebegin', '<button class="btn" data-watch>🎥 Watch the cheer move</button>');
        root.querySelector('[data-watch]').onclick = () => playVideoBubble(video, { big: true });
        playVideoBubble(video, { big: true });
      } else {
        say(lines + (extra ? ' ' + extra : ''));
      }
      await waitClick(root, '[data-go]');
      stop();
      if (!ctx.alive()) return null;
    }

    const nTarget = Math.round(size * 0.35);
    const cards = shuffle([...Array(nTarget).fill(target), ...Array(size - nTarget).fill(twin)]);
    root.innerHTML = `
      <div class="stage">
        <p class="step">Round ${r + 1} of ${ROUNDS}</p>
        <button class="target" data-say>Find every <span class="glyph inline">${esc(target)}</span> 🔊</button>
        <div class="grid g${size}">${cards.map((c, i) => `<button class="card" data-i="${i}">${esc(c)}</button>`).join('')}</div>
        <p class="hint muted">${esc(CHEER_MOVES[target] || moveFor(target, twin) || '')}</p>
      </div>`;
    const prompt = `Find every ${spoken(target)}.`;
    root.querySelector('[data-say]').onclick = () => say(prompt);
    say(prompt);
    let left = nTarget;
    while (left > 0) {
      const el = await waitClick(root, '.card:not(.found)');
      if (!ctx.alive()) return null;
      if (cards[+el.dataset.i] === target) {
        el.classList.add('found');
        sfx('ding');
        found++;
        left--;
      } else {
        wrong++;
        wiggle(el);
        sfx('soft');
        noteError('letters', `${target}>${twin}`);
        say(`That one is ${spoken(twin)}. ${CHEER_MOVES[target] || ''}`);
      }
    }
    sfx('clap');
    await say(PRAISE[(r * 3) % PRAISE.length]);
    await sleep(300);
    if (!ctx.alive()) return null;
  }
  return { items: found + wrong, correct: found };
}
