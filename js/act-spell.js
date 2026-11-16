// Give Me a Sound! — build a word from sound tiles, then chant it like a spelling cheer.
import { SPELL_LEVELS, LOOKALIKE, parseWord, spellOut } from './data.js';
import { say, sayTile, stop, sfx } from './speech.js';
import { esc, pick, sample, shuffle, waitClick, wiggle, sleep, PRAISE, ENCOURAGE } from './ui.js';
import { noteError, comebackMiss, comebackHit } from './store.js';

const COUNT = 5;

function distractors(word, n) {
  const have = new Set(word.tiles.map(t => t.label));
  const out = [];
  for (const t of shuffle(word.tiles)) {
    for (const d of LOOKALIKE[t.label] || []) {
      if (!have.has(d) && !out.includes(d)) out.push(d);
    }
  }
  return sample(out, n);
}

export async function run(ctx) {
  const { root, level, profile } = ctx;
  const comeback = Object.keys(profile.comeback || {}).slice(0, 2).map(parseWord);
  const fresh = sample(SPELL_LEVELS[level - 1].words.filter(w => !comeback.some(c => c.word === w.word)), COUNT - comeback.length);
  const words = shuffle([...comeback, ...fresh]);
  const extra = level <= 2 ? 2 : 3;
  let correct = 0;

  for (let q = 0; q < words.length; q++) {
    const w = words[q];
    const isComeback = comeback.includes(w);
    const bank = shuffle([...w.tiles.map((t, i) => ({ ...t, i })), ...distractors(w, extra).map(label => ({ label, key: label, i: -1 }))]);
    root.innerHTML = `
      <div class="stage">
        <p class="step">Word ${q + 1} of ${words.length}${isComeback ? ' · <b>Comeback word!</b>' : ''}</p>
        <button class="target" data-word>🔊 Hear the word</button>
        <div class="slots">${w.tiles.map((t, i) => `${w.syl.includes(i) ? '<span class="syl-gap"></span>' : ''}<span class="slot" data-slot="${i}"></span>`).join('')}</div>
        <div class="bank">${bank.map((t, b) => `<button class="tile" data-b="${b}">${esc(t.label)}</button>`).join('')}</div>
        <p class="hint muted">Tap the sounds in order. Each tile says its sound.</p>
      </div>`;
    const sayWord = () => say(`${w.word}.`);
    root.querySelector('[data-word]').onclick = sayWord;
    await say(`Spell ${w.word}. ${w.word}.`);
    if (!ctx.alive()) return null;

    let next = 0;
    let misses = 0;
    while (next < w.tiles.length) {
      const el = await waitClick(root, '.tile:not(.used)');
      if (!ctx.alive()) return null;
      const t = bank[+el.dataset.b];
      const need = w.tiles[next];
      if (t.label === need.label) {
        el.classList.add('used');
        const slot = root.querySelector(`[data-slot="${next}"]`);
        slot.textContent = t.label;
        slot.classList.add('filled', 'pop');
        if (need.silent) slot.classList.add('silent');
        next++;
        sfx('tap');
        await sayTile(need);
      } else {
        misses++;
        wiggle(el);
        sfx('soft');
        noteError('spell', `${need.key}>${t.label}`);
        await sayTile(t);
        if (!ctx.alive()) return null;
        if (misses >= 2) {
          const hintEl = [...root.querySelectorAll('.tile:not(.used)')].find(b => bank[+b.dataset.b].label === need.label);
          hintEl?.classList.add('glow');
          await say(`Listen for the next sound.`);
          await sayTile(need);
        } else {
          await say(pick(ENCOURAGE));
        }
      }
      if (!ctx.alive()) return null;
    }

    // The spelling cheer.
    const slots = [...root.querySelectorAll('.slot')];
    root.querySelector('.hint').textContent = 'Cheer it!';
    for (let i = 0; i < w.tiles.length; i++) {
      slots[i].classList.add('cheer');
      sfx('clap');
      if (!(await say(`Give me ${spellOut(w.tiles[i].label)}!`, { rate: 1 }))) break;
      slots[i].classList.remove('cheer');
    }
    if (!ctx.alive()) return null;
    root.querySelector('.slots').classList.add('cheer');
    await say(`What’s that spell? ${w.word}!`, { rate: 1 });

    if (misses === 0) {
      correct++;
      if (isComeback && comebackHit(w.spec)) await say(`${w.word} is mastered!`);
      else await say(pick(PRAISE));
    } else {
      comebackMiss(w.spec);
    }
    await sleep(400);
    if (!ctx.alive()) return null;
  }
  stop();
  return { items: words.length, correct };
}
