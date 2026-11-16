// Speed Warm-Up — rapid naming. Say each item aloud while tapping along.
import { RAN_LEVELS } from './data.js';
import { say, sfx } from './speech.js';
import { esc, pick, waitClick, sleep } from './ui.js';
import { personalBest } from './store.js';

const N = 20;
const TRIALS = 2;

function grid(items) {
  const out = [];
  for (let i = 0; i < N; i++) {
    let it;
    do { it = pick(items); } while (out.length && it === out[out.length - 1]);
    out.push(it);
  }
  return out;
}

const cell = it => it.color
  ? `<span class="dot" style="background:${it.color}" aria-label="${esc(it.say)}"></span>`
  : esc(it.text);

export async function run(ctx) {
  const { root, level } = ctx;
  const lvl = RAN_LEVELS[level - 1];
  const rates = [];

  for (let t = 0; t < TRIALS; t++) {
    const items = grid(lvl.items);
    root.innerHTML = `
      <div class="stage">
        <p class="step">Warm-up ${t + 1} of ${TRIALS} · ${esc(lvl.name)}</p>
        <p class="prompt">Say each one out loud as you tap. Go left to right, like reading!</p>
        <div class="ran" data-pad>${items.map((it, i) => `<span class="ran-item" data-i="${i}">${cell(it)}</span>`).join('')}</div>
        <button class="btn primary big" data-start>Ready? Start!</button>
      </div>`;
    if (t === 0) say('Say each one out loud as you tap. Go left to right, like reading!');
    await waitClick(root, '[data-start]');
    if (!ctx.alive()) return null;
    const btn = root.querySelector('[data-start]');
    for (const n of ['5, 6', '7, 8']) { btn.textContent = n + '…'; sfx('tap'); await sleep(450); }
    if (!ctx.alive()) return null;
    btn.textContent = 'Tap here (or anywhere on the grid) for the next one';
    btn.classList.add('tap-pad');
    const cells = [...root.querySelectorAll('.ran-item')];
    let i = 0;
    cells[0].classList.add('now');
    const t0 = performance.now();
    await new Promise(resolve => {
      const advance = e => {
        if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Enter' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        if (!ctx.alive()) { cleanup(); return resolve(); }
        cells[i].classList.remove('now');
        cells[i].classList.add('done');
        i++;
        if (i >= N) { cleanup(); return resolve(); }
        cells[i].classList.add('now');
      };
      const pad = root.querySelector('[data-pad]');
      const cleanup = () => { pad.removeEventListener('pointerdown', advance); btn.removeEventListener('pointerdown', advance); window.removeEventListener('keydown', advance); };
      pad.addEventListener('pointerdown', advance);
      btn.addEventListener('pointerdown', advance);
      window.addEventListener('keydown', advance);
    });
    if (!ctx.alive()) return null;
    const secs = (performance.now() - t0) / 1000;
    const perMin = Math.round((N / secs) * 60);
    rates.push(perMin);
    sfx('clap');
    btn.classList.remove('tap-pad');
    btn.textContent = `${secs.toFixed(1)} seconds!`;
    await say(`${Math.round(secs)} seconds!`);
    await sleep(500);
  }
  const best = Math.max(...rates);
  const pb = personalBest(`ran:${level}`, best);
  return { items: TRIALS * 5, correct: TRIALS * 5, metric: best, details: { personalBest: pb.better && pb.old != null, old: pb.old }, unit: 'per minute' };
}
