// Sentence Builder — say a sentence, rebuild it from word tiles, fix capitals and the end mark, then copy it on paper.
import { SENTENCE_FRAMES, WRITE_PROMPTS, JOINERS } from './data.js';
import { say, stop, sfx, listenOnce, recognitionSupported } from './speech.js';
import { esc, pick, shuffle, waitClick, wiggle, sleep, toast, PRAISE, ENCOURAGE } from './ui.js';
import { noteError, save } from './store.js';

const ROUNDS = 3;
const QWORDS = new Set(['who', 'what', 'where', 'when', 'why', 'how', 'do', 'does', 'did', 'is', 'are', 'can', 'will', 'would', 'could', 'should']);
const clean = w => w.replace(/[^A-Za-z0-9'’-]/g, '');

// Step 1: get the sentence (fill-in frame, or spoken / typed).
async function getSentence(ctx, r) {
  const { root, level, profile } = ctx;
  if (level === 1) {
    const f = pick(SENTENCE_FRAMES);
    root.innerHTML = `
      <div class="stage">
        <p class="step">Sentence ${r + 1} of ${ROUNDS}</p>
        <p class="prompt">Pick a word to finish the sentence.</p>
        <p class="frame">${esc(f.frame).replace('___', '<span class="blank">_____</span>')}</p>
        <div class="bank">${f.bank.map(w => `<button class="tile word" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>
      </div>`;
    say(`Pick a word to finish the sentence. ${f.frame.replace('___', 'blank')}`);
    const el = await waitClick(root, '[data-w]');
    stop();
    return f.frame.replace('___', el.dataset.w);
  }
  const p = pick(WRITE_PROMPTS);
  const canTalk = recognitionSupported && profile.settings.mic;
  const joinNote = level >= 3 ? `<p class="hint">Use a joining word: <b>${JOINERS.join(', ')}</b>.</p>` : '';
  for (let attempt = 0; ; attempt++) {
    root.innerHTML = `
      <div class="stage">
        <p class="step">Sentence ${r + 1} of ${ROUNDS}</p>
        <button class="target" data-say>🔊 ${esc(p.q)}</button>
        ${joinNote}
        <p class="muted small">Word bank: ${p.bank.map(esc).join(' · ')}</p>
        ${canTalk ? '<button class="btn primary big" data-talk>🎤 Tap, then say your sentence</button>' : ''}
        <div class="type-it">
          <label class="small">${canTalk ? 'Or a grown-up can type it:' : 'Say your sentence out loud. A grown-up types it here:'}
            <input data-typed maxlength="120" autocomplete="off" placeholder="Type the sentence…"></label>
          <button class="btn" data-use>Use this sentence</button>
        </div>
        <p class="heard" data-heard></p>
      </div>`;
    const ask = `${p.q}${level >= 3 ? ` Use a joining word, like and, but, because, or so.` : ''}`;
    root.querySelector('[data-say]').onclick = () => say(ask);
    say(ask);
    let text = '';
    for (;;) {
      const b = await waitClick(root, '[data-talk], [data-use]');
      if (!ctx.alive()) return null;
      if (b.dataset.talk !== undefined) {
        stop();
        b.textContent = '👂 Listening…';
        b.disabled = true;
        text = await listenOnce();
        b.disabled = false;
        b.textContent = '🎤 Try again';
        if (!ctx.alive()) return null;
        root.querySelector('[data-typed]').value = text;
        root.querySelector('[data-heard]').textContent = text ? `I heard: “${text}”. Fix it in the box if needed, then tap “Use this sentence.”` : 'I didn’t catch that. Try again!';
        continue;
      }
      text = root.querySelector('[data-typed]').value.trim();
      const n = text.split(/\s+/).filter(Boolean).length;
      if (n < 3) { toast('Make it at least 3 words.'); continue; }
      if (n > 14) { toast('Let’s keep it to 14 words or fewer.'); continue; }
      break;
    }
    const hasJoin = text.toLowerCase().split(/\s+/).map(clean).some(w => JOINERS.includes(w));
    if (level >= 3 && !hasJoin && attempt === 0) {
      await say('Can you add a joining word, like and, but, because, or so? Let’s try once more.');
      continue;
    }
    return text;
  }
}

export async function run(ctx) {
  const { root, profile } = ctx;
  let correct = 0;
  for (let r = 0; r < ROUNDS; r++) {
    const sentence = await getSentence(ctx, r);
    if (!sentence || !ctx.alive()) return null;
    const orig = sentence.replace(/[.!?]+\s*$/, '').split(/\s+/).map(clean).filter(Boolean);
    const words = orig.map(w => w.toLowerCase());
    const needCap = orig.map((w, i) => i === 0 || w.toLowerCase() === 'i' || /^i['’]/i.test(w) || (i > 0 && /^[A-Z]/.test(w)));
    const isQuestion = QWORDS.has(words[0]) || /\?\s*$/.test(sentence);

    // Step 2: build it from shuffled word tiles.
    const bank = shuffle(words.map((w, i) => ({ w, i })));
    root.innerHTML = `
      <div class="stage">
        <p class="step">Build it!</p>
        <button class="target" data-say>🔊 Hear my sentence</button>
        <div class="sentence-slots">${words.map((_, i) => `<span class="wslot" data-slot="${i}"></span>`).join('')}</div>
        <div class="bank">${bank.map((b, k) => `<button class="tile word" data-b="${k}">${esc(b.w)}</button>`).join('')}</div>
        <p class="hint muted">Tap the words in order. Each word says itself.</p>
      </div>`;
    const plain = words.join(' ');
    root.querySelector('[data-say]').onclick = () => say(plain);
    await say(`Build it! ${plain}`);
    let buildErrors = 0;
    for (let next = 0; next < words.length;) {
      const el = await waitClick(root, '.tile:not(.used)');
      if (!ctx.alive()) return null;
      const t = bank[+el.dataset.b];
      if (t.w === words[next]) {
        el.classList.add('used');
        const slot = root.querySelector(`[data-slot="${next}"]`);
        slot.textContent = t.w;
        slot.classList.add('filled', 'pop');
        sfx('tap');
        say(t.w);
        next++;
      } else {
        buildErrors++;
        wiggle(el);
        sfx('soft');
        noteError('write', 'word order');
        await say(`That says ${t.w}. Listen: ${plain}`);
      }
    }
    if (!ctx.alive()) return null;

    // Step 3: fix it up — capitals and the end mark.
    const caps = words.map(() => false);
    let end = '';
    root.innerHTML = `
      <div class="stage">
        <p class="step">Fix it up!</p>
        <p class="prompt">Tap a word to give it a capital letter. Then pick an end mark.</p>
        <div class="fix" data-fix></div>
        <div class="row ends">${['.', '?', '!'].map(m => `<button class="btn end-btn" data-end="${m}">${m === '.' ? '. period' : m === '?' ? '? question' : '! excited'}</button>`).join('')}</div>
        <button class="btn primary big" data-check>Check it</button>
        <p class="hint" data-hint></p>
      </div>`;
    const fix = root.querySelector('[data-fix]');
    const draw = () => {
      fix.innerHTML = words.map((w, i) => `<button class="fix-word ${caps[i] ? 'cap' : ''}" data-i="${i}">${esc(caps[i] ? w[0].toUpperCase() + w.slice(1) : w)}</button>`).join(' ') + `<span class="end-mark">${esc(end || ' ')}</span>`;
    };
    draw();
    fix.onclick = e => {
      const b = e.target.closest('[data-i]');
      if (b) { caps[+b.dataset.i] = !caps[+b.dataset.i]; sfx('tap'); draw(); }
    };
    root.querySelectorAll('[data-end]').forEach(b => {
      b.onclick = () => {
        end = b.dataset.end;
        root.querySelectorAll('[data-end]').forEach(x => x.classList.toggle('on', x === b));
        draw();
      };
    });
    say('Fix it up! Tap a word to give it a capital letter. Then pick an end mark.');
    let fixTries = 0;
    for (;;) {
      await waitClick(root, '[data-check]');
      if (!ctx.alive()) return null;
      const hint = root.querySelector('[data-hint]');
      let msg = '';
      if (!caps[0]) msg = 'A sentence starts with a capital letter.';
      else if (words.some((w, i) => needCap[i] && !caps[i] && (w === 'i' || /^i['’]/.test(w)))) msg = 'The word I is always a capital letter.';
      else if (words.some((_, i) => needCap[i] && !caps[i])) msg = 'Names start with a capital letter.';
      else if (words.some((_, i) => caps[i] && !needCap[i])) msg = 'Only the first word, names, and I get capitals. Check for an extra one.';
      else if (!end) msg = 'Every sentence needs an end mark.';
      else if (isQuestion && end !== '?') msg = 'This sentence asks something, so it needs a question mark.';
      else if (!isQuestion && end === '?') msg = 'This sentence tells something, so it ends with a period or an exclamation mark.';
      if (!msg) break;
      fixTries++;
      noteError('write', msg.startsWith('Every') || msg.includes('mark') ? 'end marks' : 'capitals');
      hint.textContent = msg;
      wiggle(fix);
      sfx('soft');
      await say(msg);
    }
    const finalText = words.map((w, i) => (caps[i] ? w[0].toUpperCase() + w.slice(1) : w)).join(' ') + end;

    // Step 4: read it back and copy it on paper.
    sfx('clap');
    root.innerHTML = `
      <div class="stage">
        <p class="step">You wrote a sentence!</p>
        <p class="final-sentence">${esc(finalText)}</p>
        <p class="prompt">Now copy it on paper with your pencil. ✏️</p>
        <div class="row"><button class="btn" data-skip>Skip</button><button class="btn primary big" data-copied>I copied it!</button></div>
      </div>`;
    await say(`${pick(PRAISE)} ${finalText} Now copy it on paper with your pencil.`);
    const done = await waitClick(root, '[data-skip], [data-copied]');
    if (!ctx.alive()) return null;
    profile.journal.push({ t: Date.now(), text: finalText, copied: done.dataset.copied !== undefined, level: ctx.level });
    save();
    if (buildErrors === 0 && fixTries === 0) correct++;
    else if (r < ROUNDS - 1) await say(pick(ENCOURAGE.slice(2)));
    await sleep(300);
  }
  return { items: ROUNDS, correct };
}
