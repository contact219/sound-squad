// Monthly Checkpoint — the same short check every month, so growth can be compared fairly.
// A grown-up runs it and taps the buttons; the reader reads and writes on paper.
import { CHECKPOINT, SOUNDS } from './data.js';
import { say, stop, sfx, record, putClip } from './speech.js';
import { $, esc, waitClick, confetti } from './ui.js';
import * as S from './store.js';

export function checkpointDue(p) {
  const last = p.checkpoints[p.checkpoints.length - 1];
  return !last || Date.now() - last.t > 28 * 864e5;
}

export async function checkpoint(app, { onDone }) {
  stop();
  const p = S.profile();
  app.innerHTML = `
    <div class="act-shell" style="--c:#0f766e">
      <header class="bar"><button class="exit" data-exit aria-label="Stop">✕</button><h1>📏 Monthly Checkpoint</h1><span class="lvl" data-part></span></header>
      <main class="act-body"></main>
    </div>`;
  const body = $('.act-body', app);
  const part = $('[data-part]', app);
  let dead = false;
  let stopRec = null;
  $('[data-exit]', app).onclick = () => {
    if (!confirm('Stop the checkpoint? Nothing from this checkpoint will be saved.')) return;
    dead = true; stop(); stopRec?.(); onDone();
  };
  const alive = () => !dead;

  // ---- Intro ----
  body.innerHTML = `
    <div class="stage left">
      <h2>Grown-up guide</h2>
      <p>This takes about 10 minutes. It uses the <b>same lists every month</b>, so you can see real growth.</p>
      <ol>
        <li><b>Letter sounds</b>: ${esc(p.name)} says the <i>sound</i> (not the name). You tap ✓ or ✗.</li>
        <li><b>Real words, 1 minute</b>: ${esc(p.name)} reads down the list. Tap any word that's missed.</li>
        <li><b>Made-up words, 1 minute</b>: same thing, with silly words.</li>
        <li><b>Spelling</b>: ${esc(p.name)} writes 10 words on paper. You mark them after.</li>
        <li><b>Story reading</b>: read a short story aloud. It can be recorded so you can hear the growth later.</li>
      </ol>
      <p class="muted small">Have paper and a pencil ready. Don't help during the timed parts — just say "keep going." It's okay not to know words; these lists get hard on purpose.</p>
      <button class="btn primary big" data-go>Start</button>
    </div>`;
  await waitClick(body, '[data-go]');
  if (!alive()) return;

  // ---- 1. Letter sounds ----
  part.textContent = 'Part 1 of 5';
  const soundMiss = [];
  for (let i = 0; i < CHECKPOINT.sounds.length && alive(); i++) {
    const k = CHECKPOINT.sounds[i];
    body.innerHTML = `
      <div class="stage">
        <p class="step">Letter sounds · ${i + 1} of ${CHECKPOINT.sounds.length}</p>
        <div class="nonsense">${esc(k)}</div>
        <p class="muted small">Grown-up: the sound, as in “${esc(SOUNDS[k]?.[0] || '—')}”</p>
        <div class="row"><button class="btn big miss" data-no>✗ Not yet</button><button class="btn primary big" data-yes>✓ Got it</button></div>
      </div>`;
    if (i === 0) say('What sound does this make?');
    const b = await waitClick(body, '[data-yes], [data-no]');
    const ok = b.dataset.yes !== undefined;
    if (!ok) soundMiss.push(k);
    S.soundStat(k, ok, p);
  }
  if (!alive()) return;
  const sounds = { correct: CHECKPOINT.sounds.length - soundMiss.length, total: CHECKPOINT.sounds.length, missed: soundMiss };
  p.watch = [...new Set([...p.watch, ...soundMiss])]; // star missed sounds on the sound map

  // ---- 2 & 3. One-minute word lists ----
  async function timedList(words, title, partNo) {
    part.textContent = `Part ${partNo} of 5`;
    body.innerHTML = `
      <div class="stage">
        <p class="step">${esc(title)} · 1 minute</p>
        <p class="muted small">Grown-up: tap Start, then tap any word that is missed or skipped. Don't help.</p>
        <div class="word-list" data-list>${words.map((w, i) => `<button class="wl" data-i="${i}">${esc(w)}</button>`).join('')}</div>
        <div class="row" data-ctl><button class="btn primary big" data-start>Start the minute</button></div>
      </div>`;
    const list = $('[data-list]', body);
    const ctl = $('[data-ctl]', body);
    await waitClick(ctl, '[data-start]');
    if (!alive()) return null;
    let phase = 'reading';
    list.onclick = e => {
      const w = e.target.closest('.wl');
      if (w && phase === 'reading') w.classList.toggle('missed');
    };
    const t0 = performance.now();
    ctl.innerHTML = '<span class="timer" data-t>60</span><button class="btn" data-early>Finished the whole list</button>';
    const tEl = $('[data-t]', ctl);
    const result = await new Promise(resolve => {
      const tick = setInterval(() => {
        const left = Math.max(0, 60 - Math.floor((performance.now() - t0) / 1000));
        tEl.textContent = left;
        if (!alive()) { clearInterval(tick); resolve(null); }
        if (left === 0) { clearInterval(tick); resolve({ early: false, secs: 60 }); }
      }, 250);
      $('[data-early]', ctl).onclick = () => { clearInterval(tick); resolve({ early: true, secs: Math.max(5, (performance.now() - t0) / 1000) }); };
    });
    if (!result) return null;
    sfx('ding');
    let lastIdx = words.length - 1;
    if (!result.early) {
      phase = 'last';
      ctl.innerHTML = '<p class="prompt">Time! Grown-up: tap the <b>last word</b> that was read.</p>';
      say('Time! Great reading.');
      const w = await waitClick(list, '.wl');
      lastIdx = +w.dataset.i;
    }
    const tried = [...list.querySelectorAll('.wl')].slice(0, lastIdx + 1);
    const missed = tried.filter(w => w.classList.contains('missed')).map(w => w.textContent);
    const correct = tried.length - missed.length;
    return { correct, attempted: tried.length, missed, rate: Math.round(correct * 60 / result.secs) };
  }
  const words = await timedList(CHECKPOINT.words, 'Real words', 2);
  if (!words || !alive()) return;
  const nonwords = await timedList(CHECKPOINT.nonwords, 'Made-up words', 3);
  if (!nonwords || !alive()) return;

  // ---- 4. Spelling ----
  part.textContent = 'Part 4 of 5';
  for (let i = 0; i < CHECKPOINT.spelling.length && alive(); i++) {
    const [w, sentence] = CHECKPOINT.spelling[i];
    const speak = () => say(`Number ${i + 1}. ${w}. ${sentence} ${w}.`);
    body.innerHTML = `
      <div class="stage">
        <p class="step">Spelling · word ${i + 1} of 10</p>
        <p class="prompt">Listen, then write the word on your paper.</p>
        <button class="target" data-again>🔊 Hear it again</button>
        <button class="btn primary big" data-next>${i === 9 ? 'Done writing' : 'Next word ▶'}</button>
      </div>`;
    $('[data-again]', body).onclick = speak;
    speak();
    await waitClick(body, '[data-next]');
  }
  if (!alive()) return;
  body.innerHTML = `
    <div class="stage">
      <p class="step">Spelling · grown-up check</p>
      <p class="prompt">Look at the paper and mark each word.</p>
      <div class="mark-list">${CHECKPOINT.spelling.map(([w], i) => `
        <div class="mark-row" data-row="${i}"><b>${i + 1}. ${esc(w)}</b>
          <button class="btn small" data-mark="1">✓</button><button class="btn small" data-mark="0">✗</button>
          <input class="small" data-wrote placeholder="what was written (optional)"></div>`).join('')}</div>
      <button class="btn primary big" data-done disabled>Save spelling</button>
    </div>`;
  const marks = {};
  body.onclick = e => {
    const b = e.target.closest('[data-mark]');
    if (!b) return;
    const row = b.closest('[data-row]');
    marks[row.dataset.row] = b.dataset.mark === '1';
    row.querySelectorAll('[data-mark]').forEach(x => x.classList.toggle('on', x === b));
    $('[data-done]', body).disabled = Object.keys(marks).length < CHECKPOINT.spelling.length;
  };
  await waitClick(body, '[data-done]');
  body.onclick = null;
  if (!alive()) return;
  const spelling = {
    correct: Object.values(marks).filter(Boolean).length, total: CHECKPOINT.spelling.length,
    missed: CHECKPOINT.spelling.map(([w], i) => (marks[i] ? null : { word: w, wrote: body.querySelectorAll('[data-wrote]')[i].value.trim() })).filter(Boolean),
  };

  // ---- 5. Story reading (recorded) ----
  part.textContent = 'Part 5 of 5';
  const passage = CHECKPOINT.passage;
  const pw = passage.text.replace(/\s*\/\s*/g, ' ').split(/\s+/);
  body.innerHTML = `
    <div class="stage read">
      <h2 class="story-title">${esc(passage.title)}</h2>
      <div class="passage" data-passage>${pw.map((w, i) => `<span class="w" data-w="${i}">${esc(w)}</span>`).join(' ')}</div>
      <p class="status" data-status>Read the whole story out loud. Grown-up: don't help — just say “keep going.”</p>
      <div class="controls" data-ctl>
        <label class="check rec-toggle"><input type="checkbox" data-rec checked> 🎙️ Record this reading</label>
        <button class="btn primary big" data-start>Start reading</button>
      </div>
    </div>`;
  const ctl = $('[data-ctl]', body);
  await waitClick(ctl, '[data-start]');
  if (!alive()) return;
  if ($('[data-rec]', ctl).checked) { try { stopRec = await record(); } catch { stopRec = null; } }
  const t0 = performance.now();
  ctl.innerHTML = '<span class="timer" data-t>0s</span><button class="btn primary big" data-done>Finished!</button>';
  const tick = setInterval(() => { $('[data-t]', ctl).textContent = Math.round((performance.now() - t0) / 1000) + 's'; }, 500);
  await waitClick(ctl, '[data-done]');
  clearInterval(tick);
  const secs = Math.max(5, (performance.now() - t0) / 1000);
  const blob = stopRec ? await stopRec() : null;
  stopRec = null;
  if (!alive()) return;
  $('[data-status]', body).innerHTML = '<b>Grown-up:</b> tap any word that was missed or misread, then save.';
  const pEl = $('[data-passage]', body);
  pEl.onclick = e => e.target.closest('.w')?.classList.toggle('missed');
  ctl.innerHTML = '<button class="btn primary big" data-save>Save checkpoint</button>';
  await waitClick(ctl, '[data-save]');
  if (!alive()) return;
  const readMissed = [...pEl.querySelectorAll('.w.missed')].map(w => w.textContent);
  const reading = { wcpm: Math.round((pw.length - readMissed.length) / (secs / 60)), accuracy: (pw.length - readMissed.length) / pw.length, secs: Math.round(secs), missed: readMissed };

  const t = Date.now();
  if (blob) {
    try {
      await putClip(`reading:${t}`, blob);
      p.readings.push({ t, pid: passage.id, title: `${passage.title} (checkpoint)`, wcpm: reading.wcpm, accuracy: reading.accuracy, key: `reading:${t}`, checkpoint: true });
    } catch { /* storage unavailable */ }
  }
  const prev = p.checkpoints[p.checkpoints.length - 1];
  const result = { t, sounds, words, nonwords, spelling, reading };
  p.checkpoints.push(result);
  S.save();

  // ---- Summary ----
  const row = (label, now, before, unit = '') => {
    const diff = before == null ? '' : now > before ? `<span class="up">▲ +${now - before}</span>` : now < before ? `<span class="down">▼ ${now - before}</span>` : '<span class="muted">same</span>';
    return `<tr><td>${label}</td><td><b>${now}</b> ${unit}</td><td>${before ?? '—'}</td><td>${diff}</td></tr>`;
  };
  part.textContent = 'Done';
  body.innerHTML = `
    <div class="stage">
      <div class="big-emoji">🏁</div>
      <h2>Checkpoint saved!</h2>
      <table class="cp-table"><thead><tr><th>Measure</th><th>Today</th><th>Last time</th><th>Change</th></tr></thead><tbody>
        ${row('Letter sounds', sounds.correct, prev?.sounds.correct, `of ${sounds.total}`)}
        ${row('Real words per minute', words.rate, prev?.words.rate)}
        ${row('Made-up words per minute', nonwords.rate, prev?.nonwords.rate)}
        ${row('Spelling', spelling.correct, prev?.spelling.correct, 'of 10')}
        ${row('Story: words correct per minute', reading.wcpm, prev?.reading.wcpm)}
        ${row('Story accuracy %', Math.round(reading.accuracy * 100), prev ? Math.round(prev.reading.accuracy * 100) : null)}
      </tbody></table>
      ${soundMiss.length ? `<p class="small">Sounds to practice: <b>${soundMiss.map(esc).join(', ')}</b> (added to the sound map).</p>` : ''}
      <p class="muted small">See all checkpoints in Coach's Clipboard → Checkpoints.</p>
      <button class="btn primary big" data-home>Done</button>
    </div>`;
  confetti();
  sfx('up');
  say(`Checkpoint done! Great work, ${p.name}.`);
  await waitClick(body, '[data-home]');
  onDone();
}
