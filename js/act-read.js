// Read & Cheer — phrase-scooped stories: Listen, Echo, Read it myself (timed), then questions.
import { PASSAGES } from './data.js';
import { say, stop, sfx, listen, recognitionSupported } from './speech.js';
import { esc, waitClick, wiggle, sleep, pick, shuffle, PRAISE, ENCOURAGE, confetti } from './ui.js';
import { save } from './store.js';

const norm = w => w.toLowerCase().replace(/[^a-z0-9]/g, '');

export function allStories(profile) {
  return [...PASSAGES, ...(profile.stories || [])];
}

function align(words, transcript) {
  const toks = transcript.split(/\s+/).map(norm).filter(Boolean);
  const heard = new Set();
  let i = 0;
  for (const tok of toks) {
    for (let k = i; k < Math.min(words.length, i + 4); k++) {
      const w = words[k].norm;
      if (w === tok || (w.length > 3 && tok.length > 3 && w.slice(0, 3) === tok.slice(0, 3) && Math.abs(w.length - tok.length) <= 2)) {
        heard.add(k);
        i = k + 1;
        break;
      }
    }
  }
  return heard;
}

async function picker(ctx) {
  const { root, profile, level } = ctx;
  const list = allStories(profile);
  root.innerHTML = `
    <div class="stage">
      <p class="prompt">Pick a story</p>
      <div class="story-list">
        ${list.map(p => {
          const h = profile.readHistory?.[p.id] || [];
          const last = h[h.length - 1];
          return `<button class="story ${p.level === level ? 'suggested' : ''}" data-id="${esc(p.id)}">
            <b>${esc(p.title)}</b>
            <span class="muted small">${p.level ? `Level ${p.level}` : 'Our story'}${p.level === level ? ' · just right' : ''}${last ? ` · last: ${last.wcpm} words/min` : ''}</span>
          </button>`;
        }).join('')}
      </div>
    </div>`;
  const el = await waitClick(root, '[data-id]');
  return list.find(p => p.id === el.dataset.id);
}

export async function run(ctx) {
  const { root, profile, level } = ctx;
  const passage = ctx.choose ? await picker(ctx) : (PASSAGES.find(p => p.level === level) || PASSAGES[0]);
  if (!ctx.alive() || !passage) return null;

  const phrases = passage.text.split('/').map(s => s.trim()).filter(Boolean);
  const words = [];
  const textHtml = phrases.map((ph, pi) => `<span class="phrase" data-p="${pi}">${ph.split(/\s+/).map(w => {
    words.push({ text: w, norm: norm(w), p: pi });
    return `<span class="w" data-w="${words.length - 1}">${esc(w)}</span>`;
  }).join(' ')}</span>`).join(' ');
  const history = profile.readHistory?.[passage.id] || [];
  const useMic = profile.settings.mic && recognitionSupported;

  root.innerHTML = `
    <div class="stage read">
      <h2 class="story-title">${esc(passage.title)}</h2>
      <div class="passage scoops">${textHtml}</div>
      <p class="status" data-status>Start with <b>Listen</b>. Tap any word to hear it.</p>
      <div class="controls">
        <button class="btn mode next-up" data-mode="listen">🎧 Listen</button>
        <button class="btn mode" data-mode="echo">🗣️ Echo</button>
        <button class="btn mode" data-mode="solo">⏱️ Read it myself</button>
        <button class="btn mode" data-mode="quiz">${passage.questions?.length ? '❓ Questions' : '✅ Finish'}</button>
      </div>
      <div class="controls" data-sub></div>
    </div>`;
  const status = root.querySelector('[data-status]');
  const sub = root.querySelector('[data-sub]');
  const phraseEls = [...root.querySelectorAll('.phrase')];
  const wordEls = [...root.querySelectorAll('.w')];
  const passageEl = root.querySelector('.passage');
  let token = 0;
  let mode = null; // 'solo' | 'review' while those are active
  let helped = new Set();
  let solo = null;
  let stopMic = () => {};
  ctx.onExit(() => { token++; stopMic(); });

  const nextUp = m => root.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('next-up', b.dataset.mode === m));
  const clearHl = () => phraseEls.forEach(p => p.classList.remove('hl', 'your-turn'));

  passageEl.addEventListener('click', e => {
    const w = e.target.closest('.w');
    if (!w) return;
    const i = +w.dataset.w;
    if (mode === 'review') { w.classList.toggle('missed'); return; }
    if (mode === 'solo') { helped.add(i); w.classList.add('helped'); }
    say(words[i].text.replace(/[^\w'’-]/g, ''), { rate: 0.7 });
  });

  async function listenMode() {
    const my = ++token;
    status.textContent = 'Follow the glowing words with your eyes.';
    for (let i = 0; i < phraseEls.length; i++) {
      if (my !== token || !ctx.alive()) break;
      clearHl();
      phraseEls[i].classList.add('hl');
      phraseEls[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (!(await say(phrases[i]))) break;
    }
    clearHl();
    if (my === token) { status.innerHTML = 'Next: <b>Echo</b> — I read a scoop, then you read it.'; nextUp('echo'); }
  }

  async function echoMode() {
    const my = ++token;
    for (let i = 0; i < phraseEls.length; i++) {
      if (my !== token || !ctx.alive()) return;
      clearHl();
      phraseEls[i].classList.add('hl');
      phraseEls[i].scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      status.textContent = 'My turn…';
      sub.innerHTML = '';
      if (!(await say(phrases[i]))) return;
      phraseEls[i].classList.replace('hl', 'your-turn');
      status.innerHTML = '<b>Your turn!</b> Read the glowing scoop out loud.';
      sub.innerHTML = '<button class="btn" data-again>🔁 Hear it again</button><button class="btn primary" data-next>Next ▶</button>';
      for (;;) {
        const b = await waitClick(sub, 'button');
        if (my !== token) return;
        if (b.dataset.again !== undefined) { await say(phrases[i]); continue; }
        break;
      }
    }
    clearHl();
    sub.innerHTML = '';
    sfx('clap');
    status.innerHTML = 'Great echo! Next: <b>Read it myself</b>.';
    nextUp('solo');
  }

  async function soloMode() {
    const my = ++token;
    stop();
    clearHl();
    helped = new Set();
    wordEls.forEach(w => w.classList.remove('helped', 'missed', 'heard'));
    status.innerHTML = `Read the whole story out loud. Tap a word if you get stuck.${useMic ? ' Words light up as I hear them!' : ''}`;
    sub.innerHTML = '<button class="btn primary big" data-go>Start reading</button>';
    await waitClick(sub, '[data-go]');
    if (my !== token) return;
    mode = 'solo';
    let heard = new Set();
    if (useMic) {
      stopMic = listen(text => {
        heard = align(words, text);
        wordEls.forEach((w, i) => w.classList.toggle('heard', heard.has(i)));
      });
    }
    const t0 = performance.now();
    sub.innerHTML = '<span class="timer" data-t>0s</span><button class="btn primary big" data-done>I’m done!</button>';
    const tEl = sub.querySelector('[data-t]');
    const tick = setInterval(() => { tEl.textContent = Math.round((performance.now() - t0) / 1000) + 's'; }, 500);
    await waitClick(sub, '[data-done]');
    clearInterval(tick);
    stopMic();
    if (my !== token) return;
    const secs = Math.max(5, (performance.now() - t0) / 1000);
    mode = 'review';
    wordEls.forEach((w, i) => w.classList.toggle('missed', helped.has(i) || (useMic && !heard.has(i))));
    status.innerHTML = '<b>Grown-up check:</b> tap any word that was skipped or misread (tap again to undo). Then save.';
    sub.innerHTML = '<button class="btn primary" data-save>Save my reading</button>';
    await waitClick(sub, '[data-save]');
    if (my !== token) return;
    mode = null;
    const missed = wordEls.filter(w => w.classList.contains('missed')).length;
    const right = words.length - missed;
    const wcpm = Math.round(right / (secs / 60));
    const accuracy = right / words.length;
    const prev = history[history.length - 1];
    solo = { wcpm, accuracy, secs: Math.round(secs) };
    profile.readHistory = profile.readHistory || {};
    profile.readHistory[passage.id] = [...history, { t: Date.now(), wcpm, accuracy }];
    save();
    sfx('up');
    let msg = `${wcpm} words correct per minute!`;
    if (prev && wcpm > prev.wcpm) { msg += ` That beats last time (${prev.wcpm})!`; confetti(); }
    status.innerHTML = `<b>${esc(msg)}</b> ${passage.questions?.length ? 'Next: <b>Questions</b>.' : ''}`;
    sub.innerHTML = '';
    say(msg);
    nextUp('quiz');
  }

  async function quiz() {
    ++token;
    stop();
    stopMic();
    const qs = passage.questions || [];
    let correct = 0;
    for (let q = 0; q < qs.length; q++) {
      const raw = qs[q];
      const order = shuffle(raw.choices.map((_, i) => i));
      const it = { ...raw, choices: order.map(i => raw.choices[i]), a: order.indexOf(raw.a) };
      root.innerHTML = `
        <div class="stage">
          <p class="step">Question ${q + 1} of ${qs.length} · ${esc(it.kind || '')}</p>
          <button class="target" data-say>🔊 ${esc(it.q)}</button>
          <div class="options list">${it.choices.map((c, i) => `<button class="option" data-c="${i}"><span class="opt-text">${esc(c)}</span></button>`).join('')}</div>
          <details class="look-back"><summary>Look back at the story</summary><p class="passage">${esc(passage.text.replace(/\s*\/\s*/g, ' '))}</p></details>
        </div>`;
      const read = async () => {
        await say(it.q);
        for (let i = 0; i < it.choices.length; i++) { if (!(await say(it.choices[i]))) return; await sleep(120); }
      };
      root.querySelector('[data-say]').onclick = read;
      read();
      let tries = 0;
      for (;;) {
        const el = await waitClick(root, '[data-c]');
        if (!ctx.alive()) return null;
        stop();
        if (+el.dataset.c === it.a) {
          el.classList.add('right');
          sfx('ding');
          if (tries === 0) correct++;
          await say(pick(PRAISE));
          break;
        }
        tries++;
        wiggle(el);
        sfx('soft');
        say(pick(ENCOURAGE));
      }
      await sleep(400);
    }
    return {
      items: qs.length, correct, metric: solo ? solo.wcpm : null, unit: 'words correct per minute',
      details: { pid: passage.id, title: passage.title, accuracy: solo?.accuracy, secs: solo?.secs },
    };
  }

  for (;;) {
    const b = await waitClick(root.querySelector('.stage > .controls'), '[data-mode]');
    if (!ctx.alive()) return null;
    const m = b.dataset.mode;
    if (mode === 'solo' || mode === 'review') {
      if (m !== 'quiz') continue; // finish the reading first
    }
    mode = null;
    sub.innerHTML = '';
    if (m === 'listen') listenMode();
    else if (m === 'echo') echoMode();
    else if (m === 'solo') soloMode();
    else return quiz();
  }
}
