// Cheer Names — sound out made-up words (memory can't help) and clap the syllables in long words.
import { DECODE_LEVELS, SYLLABLE_WORDS, nonsenseWord, nonsenseVariant } from './data.js';
import { say, stop, sfx } from './speech.js';
import { esc, pick, shuffle, waitClick, wiggle, sleep, PRAISE, ENCOURAGE } from './ui.js';
import { noteError } from './store.js';

const COUNT = 6;

async function nonsenseItem(ctx, q, level, used) {
  const { root } = ctx;
  let word = nonsenseWord(level);
  for (let i = 0; i < 10 && used.has(word); i++) word = nonsenseWord(level);
  used.add(word);
  const opts = shuffle([word, ...new Set([nonsenseVariant(word, level), nonsenseVariant(word, level)])].filter((w, i, a) => a.indexOf(w) === i)).slice(0, 3);
  if (!opts.includes(word)) opts[0] = word;
  root.innerHTML = `
    <div class="stage">
      <p class="step">Squad name ${q + 1} of ${COUNT}</p>
      <p class="prompt">Sound out this silly squad name. It's not a real word!</p>
      <div class="nonsense">${esc(word)}</div>
      <p class="muted">Say it out loud first. Then find the one that sounds the same.</p>
      <div class="options count">${opts.map((o, i) => `
        <div class="option listen-opt" data-choice="${esc(o)}">
          <button class="ear big" data-say="${esc(o)}" aria-label="Hear choice ${i + 1}">🔊 ${i + 1}</button>
          <span class="small">This one</span>
        </div>`).join('')}</div>
    </div>`;
  root.onclick = e => {
    const s = e.target.closest('[data-say]');
    if (s) { e.stopImmediatePropagation(); say(s.dataset.say, { rate: 0.75 }); }
  };
  await say('Sound out this silly squad name. Then tap the speakers to find the one that matches.');
  if (!ctx.alive()) return null;
  let tries = 0;
  for (;;) {
    const el = await waitClick(root, '[data-choice]');
    if (!ctx.alive()) return null;
    stop();
    if (el.dataset.choice === word) {
      el.classList.add('right');
      sfx('ding');
      await say(`${pick(PRAISE)} ${word}!`, { rate: 0.8 });
      root.onclick = null;
      return tries === 0;
    }
    tries++;
    wiggle(el);
    sfx('soft');
    noteError('decode', `${word}>${el.dataset.choice}`);
    await say(pick(ENCOURAGE));
    if (!ctx.alive()) return null;
  }
}

async function syllableItem(ctx, q, spec) {
  const { root } = ctx;
  const parts = spec.split('|');
  const word = parts.join('');
  root.innerHTML = `
    <div class="stage">
      <p class="step">Word ${q + 1} of ${COUNT}</p>
      <button class="target big-word" data-say>🔊 ${esc(word)}</button>
      <p class="prompt">Clap the parts! Tap the pom-pom once for each part you hear.</p>
      <button class="clap-pad" data-clap aria-label="Clap">👏</button>
      <p class="claps" data-n>0 claps</p>
      <div class="row"><button class="btn" data-reset>Start over</button><button class="btn primary" data-done>Done</button></div>
      <div class="chunks" data-chunks></div>
    </div>`;
  let n = 0;
  const nEl = root.querySelector('[data-n]');
  root.querySelector('[data-say]').onclick = () => say(word, { rate: 0.7 });
  root.querySelector('[data-clap]').onclick = () => { n++; sfx('clap'); nEl.textContent = `${n} clap${n === 1 ? '' : 's'}`; };
  root.querySelector('[data-reset]').onclick = () => { n = 0; nEl.textContent = '0 claps'; };
  await say(`Clap the parts in ${word}.`);
  let tries = 0;
  for (;;) {
    await waitClick(root, '[data-done]');
    if (!ctx.alive()) return null;
    if (n === parts.length) break;
    tries++;
    noteError('decode', 'syllables');
    sfx('soft');
    await say(`Almost! Listen: ${parts.join(' ... ')}. Try again.`, { rate: 0.7 });
    n = 0;
    nEl.textContent = '0 claps';
  }
  sfx('ding');
  const box = root.querySelector('[data-chunks]');
  box.innerHTML = parts.map((p, i) => `<span class="chunk c${i % 4}">${esc(p)}</span>`).join('');
  for (const p of parts) { if (!(await say(p, { rate: 0.8 }))) break; await sleep(150); }
  await say(`${word}! ${parts.length} parts.`);
  return tries === 0;
}

export async function run(ctx) {
  const { level } = ctx;
  const L = DECODE_LEVELS[level - 1];
  let correct = 0;
  // Mix in a few syllable claps once that level is reached.
  const plan = Array.from({ length: COUNT }, (_, i) => (L.syllables || (level > 5 && i % 3 === 2) ? 'syl' : 'non'));
  const sylWords = shuffle(SYLLABLE_WORDS);
  const used = new Set();
  for (let q = 0; q < COUNT; q++) {
    const lv = L.syllables ? 4 : level;
    const ok = plan[q] === 'syl' ? await syllableItem(ctx, q, sylWords[q]) : await nonsenseItem(ctx, q, lv, used);
    if (ok === null) return null;
    if (ok) correct++;
    await sleep(400);
    if (!ctx.alive()) return null;
  }
  return { items: COUNT, correct };
}
