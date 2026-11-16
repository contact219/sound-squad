// Echo Routine — working memory. Watch and listen to a sequence, then tap it back (forward or backward).
import { MEMORY_LEVELS, LETTER_NAMES } from './data.js';
import { say, sfx } from './speech.js';
import { esc, pick, waitClick, sleep, PRAISE } from './ui.js';
import { save } from './store.js';

const TRIALS = 6;
const COLORS = ['#e2366b', '#f5b400', '#2b8bd8', '#2aa36b', '#7a3ff2', '#ff7a1a', '#14b8a6', '#d946ef', '#64748b'];

export async function run(ctx) {
  const { root, level, profile } = ctx;
  const mode = MEMORY_LEVELS[level - 1];
  const spanKey = `m${level}`;
  let span = profile.memSpan?.[spanKey] || mode.start;
  let best = 0;
  let correct = 0;
  let streak = 0;
  const spoken = s => LETTER_NAMES[s] || s;

  for (let t = 0; t < TRIALS; t++) {
    const seq = [];
    while (seq.length < span) {
      const s = pick(mode.set);
      if (s !== seq[seq.length - 1]) seq.push(s);
    }
    root.innerHTML = `
      <div class="stage">
        <p class="step">Routine ${t + 1} of ${TRIALS} · ${span} counts · ${esc(mode.name)}</p>
        <p class="prompt" data-msg>Watch and listen…</p>
        <div class="pads">${mode.set.map((s, i) => `<button class="pad" data-s="${esc(s)}" style="--c:${COLORS[i]}" disabled>${esc(s)}</button>`).join('')}</div>
        <div class="echo-line" data-line></div>
      </div>`;
    const pads = Object.fromEntries([...root.querySelectorAll('.pad')].map(p => [p.dataset.s, p]));
    const msg = root.querySelector('[data-msg]');
    await sleep(500);
    for (let i = 0; i < seq.length; i++) {
      if (!ctx.alive()) return null;
      const p = pads[seq[i]];
      p.classList.add('lit');
      await say(spoken(seq[i]), { rate: 0.9 });
      p.classList.remove('lit');
      // Chunk into groups of 3 with a longer pause, like counts in a routine.
      await sleep(span >= 5 && (i + 1) % 3 === 0 ? 650 : 200);
    }
    if (!ctx.alive()) return null;
    const answer = mode.backward ? [...seq].reverse() : seq;
    msg.innerHTML = mode.backward ? '<b>Your turn — BACKWARDS!</b> Last one first.' : '<b>Your turn!</b> Same order.';
    say(mode.backward ? 'Your turn. Backwards!' : 'Your turn!');
    Object.values(pads).forEach(p => { p.disabled = false; });
    const line = root.querySelector('[data-line]');

    let ok = true;
    for (let i = 0; i < answer.length; i++) {
      const el = await waitClick(root, '.pad');
      if (!ctx.alive()) return null;
      el.classList.add('lit');
      setTimeout(() => el.classList.remove('lit'), 250);
      sfx('tap');
      line.insertAdjacentHTML('beforeend', `<span>${esc(el.dataset.s)}</span>`);
      if (el.dataset.s !== answer[i]) { ok = false; break; }
    }
    Object.values(pads).forEach(p => { p.disabled = true; });
    if (ok) {
      correct++;
      best = Math.max(best, span);
      streak++;
      sfx('ding');
      msg.textContent = pick(PRAISE);
      await say(pick(PRAISE));
      if (streak >= 2) { span = Math.min(9, span + 1); streak = 0; }
    } else {
      sfx('soft');
      msg.innerHTML = `Almost! It was <b>${answer.map(esc).join(' · ')}</b>`;
      await say(`Almost! It was ${answer.map(spoken).join(', ')}.`);
      span = Math.max(2, span - 1);
      streak = 0;
    }
    await sleep(700);
  }
  profile.memSpan = { ...(profile.memSpan || {}), [spanKey]: Math.max(mode.start, span) };
  save();
  return { items: TRIALS, correct, metric: best, unit: 'longest routine' };
}
