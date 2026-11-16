// Coach's Clipboard — the grown-up side: progress, trouble spots, settings, voice recordings, stories, backups.
import * as S from './store.js';
import { SKILLS, SKILL_INFO } from './store.js';
import { LEVEL_NAME, LEVEL_COUNTS, SOUNDS, parseWord } from './data.js';
import { say, voices, getClip, putClip, deleteClip, clipKeys, playBlob, record, tileText, recognitionSupported } from './speech.js';
import { $, esc, lineChart, toast } from './ui.js';

const TABS = [['progress', '📈 Progress'], ['settings', '⚙️ Settings'], ['voice', '🎙️ Your voice'], ['stories', '📚 Stories'], ['squad', '👥 Readers & backup']];
let tab = 'progress';

export function coach(app, opts) {
  const p = S.profile();
  app.innerHTML = `
    <div class="page coach">
      <header class="topbar">
        <div><h1>📋 Coach's Clipboard</h1><p class="muted">${esc(p.name)} · ${p.grade === 0 ? 'Kindergarten' : p.grade === 13 ? 'Adult' : 'Grade ' + p.grade}</p></div>
        <button class="btn primary" data-close>Back to ${esc(p.name)}'s page</button>
      </header>
      <nav class="tabs">${TABS.map(([k, t]) => `<button class="tab ${k === tab ? 'on' : ''}" data-tab="${k}">${t}</button>`).join('')}</nav>
      <section class="tab-body"></section>
    </div>`;
  $('[data-close]', app).onclick = opts.onClose;
  app.querySelectorAll('[data-tab]').forEach(b => { b.onclick = () => { tab = b.dataset.tab; coach(app, opts); }; });
  const body = $('.tab-body', app);
  ({ progress, settings, voice, stories, squad })[tab](body, p, app, opts);
}

// ---------- Progress ----------
const pct = x => Math.round(x * 100) + '%';

function sessionsFor(p, skill) { return p.sessions.filter(s => s.skill === skill); }

function skillSeries(p, skill) {
  const ss = sessionsFor(p, skill);
  if (['ran', 'memory', 'fluency'].includes(skill)) {
    return ss.filter(s => s.metric != null).map(s => ({ x: s.t, y: s.metric }));
  }
  return ss.filter(s => s.items).map(s => ({ x: s.t, y: Math.round((s.correct / s.items) * 100) }));
}

const SERIES_LABEL = { ran: 'items named per minute', memory: 'longest routine remembered', fluency: 'words correct per minute' };

function explainError(key) {
  const [kind, rest] = key.split(':');
  if (kind === 'letters') { const [want, got] = rest.split('>'); return `Looking for “${want}”, tapped “${got}”`; }
  if (kind === 'spell') {
    const [want, got] = rest.split('>');
    return `Spelling: needed “${want.replace(/\(.*\)/, '').replace('*', '')}” (${tileText({ key: want, label: want.replace(/\(.*\)/, '').replace('*', ''), silent: want === 'e*' })}), picked “${got}”`;
  }
  if (kind === 'phon') {
    return { first: 'Matching first sounds', last: 'Matching last sounds', middle: 'Matching middle (vowel) sounds', count: 'Counting sounds in a word', elideFirst: 'Taking away the first sound', elideLast: 'Taking away the last sound', elideMiddle: 'Taking away a middle sound' }[rest] || rest;
  }
  return key;
}

function progress(body, p) {
  const weekAgo = Date.now() - 7 * 864e5;
  const daysWeek = p.days.filter(d => new Date(d + 'T12:00:00').getTime() >= weekAgo).length;
  const minutes = Math.round(p.sessions.reduce((n, s) => n + (s.ms || 0), 0) / 60000);
  const errors = Object.entries(p.errors).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const comeback = Object.keys(p.comeback || {}).map(s => parseWord(s).word);
  const mastered = (p.mastered || []).map(s => parseWord(s).word);

  body.innerHTML = `
    <div class="stats">
      <div class="stat-card"><b>${p.days.length}</b><span>days practiced</span></div>
      <div class="stat-card"><b>${daysWeek}</b><span>days this week</span></div>
      <div class="stat-card"><b>${minutes}</b><span>minutes total</span></div>
      <div class="stat-card"><b>${S.streak(p)}</b><span>day streak</span></div>
      <div class="stat-card"><b>${p.sessions.length}</b><span>activities done</span></div>
    </div>
    <p class="muted small">Aim for short, frequent practice: 10–15 minutes, 4–5 days a week, beats one long session.</p>

    <div class="skill-cards">
      ${SKILLS.map(k => {
        const info = SKILL_INFO[k];
        const ss = sessionsFor(p, k);
        const series = skillSeries(p, k).slice(-20);
        const label = SERIES_LABEL[k] || '% right on the first try';
        return `
        <article class="card skill" style="--c:${info.color}">
          <header><h3>${info.emoji} ${esc(info.title)}</h3>
            <label class="small">Level
              <select data-level="${k}">${Array.from({ length: LEVEL_COUNTS[k] }, (_, i) => `<option value="${i + 1}" ${p.levels[k] === i + 1 ? 'selected' : ''}>${i + 1}. ${esc(LEVEL_NAME[k](i + 1) || '')}</option>`).join('')}</select>
            </label>
          </header>
          <p class="small">${esc(info.coach)}</p>
          <p class="small muted"><b>Report link:</b> ${esc(info.report)}</p>
          <p class="small"><b>${ss.length}</b> sessions · chart shows ${esc(label)}</p>
          ${lineChart(series, { color: info.color, fmt: v => (SERIES_LABEL[k] ? v : v + '%'), min: SERIES_LABEL[k] ? undefined : 0, max: SERIES_LABEL[k] ? undefined : 100 })}
        </article>`;
      }).join('')}
    </div>

    <div class="two-col">
      <article class="card">
        <h3>Trouble spots</h3>
        <p class="small muted">The mix-ups that happen most. The app brings these back into practice automatically.</p>
        ${errors.length ? `<ol class="errors">${errors.map(([k, n]) => `<li>${esc(explainError(k))} <span class="muted">×${n}</span></li>`).join('')}</ol>` : '<p class="muted small">None yet.</p>'}
      </article>
      <article class="card">
        <h3>Words</h3>
        <p class="small"><b>Comeback words</b> (missed, coming back until spelled right twice):</p>
        <p class="words">${comeback.length ? comeback.map(esc).join(', ') : '<span class="muted small">None right now.</span>'}</p>
        <p class="small"><b>Mastered</b> (${mastered.length}):</p>
        <p class="words">${mastered.length ? mastered.map(esc).join(', ') : '<span class="muted small">Not yet — they’ll show up here.</span>'}</p>
      </article>
    </div>

    <article class="card">
      <h3>Coach notes</h3>
      <p class="small muted">Jot down what you notice: mood, what clicked, what to tell the therapist.</p>
      <div class="row"><textarea data-note rows="2" placeholder="e.g. Read ‘The Flip Contest’ with expression today!"></textarea><button class="btn" data-addnote>Add note</button></div>
      <ul class="notes">${[...(p.notes || [])].reverse().map(n => `<li><span class="muted small">${esc(new Date(n.t).toLocaleDateString())}</span> ${esc(n.text)}</li>`).join('')}</ul>
    </article>

    <div class="row"><button class="btn primary" data-print>🖨️ Print progress report</button></div>`;

  body.querySelectorAll('[data-level]').forEach(sel => {
    sel.onchange = () => { p.levels[sel.dataset.level] = +sel.value; p.recent[sel.dataset.level] = []; S.save(); toast('Level changed'); };
  });
  $('[data-addnote]', body).onclick = () => {
    const ta = $('[data-note]', body);
    if (!ta.value.trim()) return;
    p.notes = [...(p.notes || []), { t: Date.now(), text: ta.value.trim() }];
    S.save();
    progress(body, p);
  };
  $('[data-print]', body).onclick = () => printReport(p);
}

function printReport(p) {
  const first = p.sessions[0]?.t;
  const rows = SKILLS.map(k => {
    const series = skillSeries(p, k);
    const firstV = series[0]?.y;
    const lastV = series[series.length - 1]?.y;
    const unit = SERIES_LABEL[k] || '% first-try accuracy';
    return `<tr><td>${esc(SKILL_INFO[k].title)}</td><td>${p.levels[k]}. ${esc(LEVEL_NAME[k](p.levels[k]) || '')}</td><td>${sessionsFor(p, k).length}</td>
      <td>${firstV ?? '—'}</td><td>${lastV ?? '—'}</td><td>${esc(unit)}</td></tr>`;
  }).join('');
  const reads = Object.entries(p.readHistory || {}).map(([id, h]) => `<li>${esc(id)}: ${h.map(x => x.wcpm).join(' → ')} words correct/min</li>`).join('');
  const errors = Object.entries(p.errors).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `<li>${esc(explainError(k))} (×${n})</li>`).join('');
  const box = document.getElementById('print');
  box.innerHTML = `
    <h1>Sound Squad progress report</h1>
    <p><b>${esc(p.name)}</b> · printed ${esc(new Date().toLocaleDateString())}${first ? ` · practicing since ${esc(new Date(first).toLocaleDateString())}` : ''}</p>
    <p>${p.days.length} practice days · ${Math.round(p.sessions.reduce((n, s) => n + (s.ms || 0), 0) / 60000)} minutes · ${p.sessions.length} activities</p>
    <h2>Skills</h2>
    <table><thead><tr><th>Activity</th><th>Current level</th><th>Sessions</th><th>First</th><th>Latest</th><th>Measure</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Repeated reading (words correct per minute)</h2><ul>${reads || '<li>None yet</li>'}</ul>
    <h2>Most frequent mix-ups</h2><ul>${errors || '<li>None recorded</li>'}</ul>
    <h2>Mastered spelling words</h2><p>${(p.mastered || []).map(s => esc(parseWord(s).word)).join(', ') || 'None yet'}</p>
    <h2>Coach notes</h2><ul>${(p.notes || []).map(n => `<li>${esc(new Date(n.t).toLocaleDateString())}: ${esc(n.text)}</li>`).join('') || '<li>None</li>'}</ul>
    <p class="small">Home practice data from the Sound Squad app. These are practice measures, not standardized test scores.</p>`;
  window.print();
}

// ---------- Settings ----------
function settings(body, p, app, opts) {
  const s = p.settings;
  const tints = { cream: '#fbf5e6', blue: '#e8f1fb', green: '#eaf6ec', peach: '#fdeee6', gray: '#efeff2', white: '#ffffff' };
  body.innerHTML = `
    <div class="two-col">
      <article class="card form">
        <h3>Reading look</h3>
        <label>Font <select data-k="font">${['Lexend', 'Verdana', 'Comic Sans MS', 'Arial'].map(f => `<option ${s.font === f ? 'selected' : ''}>${f}</option>`).join('')}</select></label>
        <label>Text size <input type="range" min="18" max="40" data-k="size" value="${s.size}"></label>
        <label>Letter spacing <input type="range" min="0" max="0.2" step="0.01" data-k="spacing" value="${s.spacing}"></label>
        <label>Line spacing <input type="range" min="1.3" max="2.4" step="0.1" data-k="lineHeight" value="${s.lineHeight}"></label>
        <fieldset><legend>Background tint</legend><div class="swatches">${Object.entries(tints).map(([k, c]) => `<label class="swatch" style="--c:${c}" title="${k}"><input type="radio" name="tint" value="${k}" ${s.tint === k ? 'checked' : ''}><span></span></label>`).join('')}</div></fieldset>
        <p class="sample">The quick brown fox jumps over the lazy dog. b d p q u y</p>
      </article>
      <article class="card form">
        <h3>Voice and practice</h3>
        <label>Voice <select data-k="voiceURI"><option value="">Automatic</option>${voices().map(v => `<option value="${esc(v.voiceURI)}" ${s.voiceURI === v.voiceURI ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
        <label>Talking speed <input type="range" min="0.6" max="1.2" step="0.05" data-k="rate" value="${s.rate}"></label>
        <button class="btn" data-test>🔊 Test voice</button>
        <label>Daily routine
          <select data-k="routine"><option value="regular" ${s.routine === 'regular' ? 'selected' : ''}>Regular (5 activities, ~12 min)</option><option value="short" ${s.routine === 'short' ? 'selected' : ''}>Short (3 activities, ~7 min)</option></select></label>
        <label class="check"><input type="checkbox" data-k="breaks" ${s.breaks ? 'checked' : ''}> Stunt breaks (movement between activities)</label>
        <label class="check"><input type="checkbox" data-k="sfx" ${s.sfx ? 'checked' : ''}> Sound effects</label>
        <label class="check"><input type="checkbox" data-k="mic" ${s.mic ? 'checked' : ''} ${recognitionSupported ? '' : 'disabled'}> Microphone reading check</label>
        <p class="small muted">${recognitionSupported
          ? 'When on, words light up as they are read aloud in “Read it myself.” This uses the browser’s speech service, which may send audio to Google or Apple to turn it into text. Leave it off to keep everything on this device.'
          : 'This browser can’t listen to reading. Try Chrome, Edge or Safari. A grown-up can still mark missed words by tapping them.'}</p>
      </article>
    </div>`;
  const apply = (k, v) => { S.updateSettings({ [k]: v }); opts.applySettings(); };
  body.querySelectorAll('[data-k]').forEach(el => {
    el.oninput = el.onchange = () => {
      const k = el.dataset.k;
      apply(k, el.type === 'checkbox' ? el.checked : el.type === 'range' ? +el.value : el.value);
    };
  });
  body.querySelectorAll('input[name=tint]').forEach(r => { r.onchange = () => apply('tint', r.value); });
  $('[data-test]', body).onclick = () => say('Give me an R! Give me an A, I! Give me an N! What’s that spell? Rain!');
}

// ---------- Grown-up voice ----------
const VOICE_GROUPS = [
  ['Short vowels', 'a e i o u'], ['Long vowels (magic e)', 'A I O U'], ['Consonants', 'b c d f g h j k l m n p r s t v w y z'],
  ['Sound teams', 'sh ch th ck ng ll ss'], ['Vowel teams', 'ai ay ee ea oa ow(oh) ow ou oi oy oo oo(u)'],
  ['Bossy r', 'ar or er ir ur eer'], ['Tricky sounds', 'g(j) c(s) y(ee) ed(d) ed(t) ing'],
];

async function voice(body) {
  const have = new Set(await clipKeys());
  body.innerHTML = `
    <article class="card">
      <h3>Record the sounds in your own voice</h3>
      <p class="small">Computer voices can't say a pure letter sound like /b/ — they say “bee, as in bat.” If you record the real sound (short and crisp: “/b/”, not “buh”), the app uses <b>your voice</b> instead. Kids often work harder for a voice they love. Recordings stay on this device.</p>
      <p class="small muted">Tap ● to start, tap ■ to stop. Record only the ones you want — any you skip use the computer voice.</p>
    </article>
    ${VOICE_GROUPS.map(([g, keys]) => `
      <article class="card">
        <h3>${esc(g)}</h3>
        <div class="rec-grid">${keys.split(' ').map(k => {
          const label = k.replace(/\(.*\)/, '');
          const kw = SOUNDS[k]?.[0] || '';
          const id = `sound:${k}`;
          return `<div class="rec ${have.has(id) ? 'has' : ''}" data-key="${esc(id)}" data-tile="${esc(k)}">
            <b>${esc(label)}</b><span class="small muted">as in ${esc(kw)}</span>
            <div class="rec-btns"><button class="btn small" data-act="play" aria-label="Play">▶</button><button class="btn small rec-btn" data-act="rec" aria-label="Record">●</button><button class="btn small" data-act="del" aria-label="Delete" ${have.has(id) ? '' : 'disabled'}>✕</button></div>
          </div>`;
        }).join('')}</div>
      </article>`).join('')}`;

  let stopper = null;
  body.onclick = async e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('.rec');
    const key = row.dataset.key;
    const tileKey = row.dataset.tile;
    if (b.dataset.act === 'play') {
      const clip = await getClip(key);
      if (clip) playBlob(clip);
      else say(tileText({ key: tileKey, label: tileKey.replace(/\(.*\)/, '') }));
    } else if (b.dataset.act === 'del') {
      await deleteClip(key);
      row.classList.remove('has');
      b.disabled = true;
    } else if (b.dataset.act === 'rec') {
      if (stopper) {
        const blob = await stopper();
        stopper = null;
        body.querySelectorAll('.recording').forEach(x => x.classList.remove('recording'));
        const active = body.querySelector('.rec-btn.on');
        active?.classList.remove('on');
        if (active) active.textContent = '●';
        const r = active?.closest('.rec');
        if (r) { await putClip(r.dataset.key, blob); r.classList.add('has'); r.querySelector('[data-act=del]').disabled = false; playBlob(blob); }
        return;
      }
      try {
        stopper = await record();
        b.classList.add('on');
        b.textContent = '■';
        row.classList.add('recording');
      } catch {
        toast('Microphone not available. Check the browser permission.', 3000);
      }
    }
  };
}

// ---------- Custom stories ----------
function chunkPhrases(text) {
  const parts = text.replace(/\s+/g, ' ').trim().split(/(?<=[.,!?;:])\s+/);
  const out = [];
  for (const part of parts) {
    const words = part.split(' ');
    for (let i = 0; i < words.length; i += 5) out.push(words.slice(i, i + 5).join(' '));
  }
  return out.join(' / ');
}

function stories(body, p) {
  body.innerHTML = `
    <article class="card form">
      <h3>Add your own story</h3>
      <p class="small">Paste a passage from your homeschool lessons, a library book, or a note you wrote. The app breaks it into short “scoops” for phrase-by-phrase reading, reads it aloud, and times repeated readings.</p>
      <label>Title <input data-title maxlength="60"></label>
      <label>Text <textarea data-text rows="6"></textarea></label>
      <button class="btn primary" data-add>Add story</button>
    </article>
    <article class="card">
      <h3>Our stories</h3>
      ${(p.stories || []).length ? `<ul class="notes">${p.stories.map(s => `<li><b>${esc(s.title)}</b> <button class="btn small" data-del="${esc(s.id)}">Remove</button></li>`).join('')}</ul>` : '<p class="muted small">None yet. Built-in stories are always available.</p>'}
    </article>`;
  $('[data-add]', body).onclick = () => {
    const title = $('[data-title]', body).value.trim();
    const text = $('[data-text]', body).value.trim();
    if (!title || !text) { toast('Add a title and some text.'); return; }
    p.stories = [...(p.stories || []), { id: 'c' + Date.now().toString(36), title, text: chunkPhrases(text), questions: [], level: 0 }];
    S.save();
    toast('Story added');
    stories(body, p);
  };
  body.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = () => { p.stories = p.stories.filter(s => s.id !== b.dataset.del); S.save(); stories(body, p); };
  });
}

// ---------- Readers & backup ----------
function squad(body, p, app, opts) {
  const list = S.all().profiles;
  body.innerHTML = `
    <div class="two-col">
      <article class="card">
        <h3>Readers</h3>
        <p class="small muted">Sound Squad works for any age. Each reader gets their own levels and progress.</p>
        <ul class="notes">${list.map(x => `<li><span class="avatar" style="background:${x.color}">${esc(x.name[0]?.toUpperCase())}</span> <b>${esc(x.name)}</b> ${x.id === p.id ? '<span class="muted small">(active)</span>' : `<button class="btn small" data-use="${x.id}">Switch to</button>`} <button class="btn small" data-rm="${x.id}">Delete</button></li>`).join('')}</ul>
        <button class="btn" data-new>+ Add a reader</button>
      </article>
      <article class="card">
        <h3>Backup</h3>
        <p class="small">Save a backup file to keep progress safe or move it to another device (voice recordings are not included).</p>
        <div class="row"><button class="btn primary" data-export>⬇️ Save backup</button>
        <label class="btn">⬆️ Restore backup<input type="file" accept="application/json,.json" data-import hidden></label></div>
      </article>
    </div>`;
  body.querySelectorAll('[data-use]').forEach(b => { b.onclick = () => { S.setActive(b.dataset.use); opts.applySettings(); coach(app, opts); }; });
  body.querySelectorAll('[data-rm]').forEach(b => {
    b.onclick = () => {
      const x = list.find(y => y.id === b.dataset.rm);
      if (!confirm(`Delete ${x.name} and all of their progress? This cannot be undone.`)) return;
      S.deleteProfile(x.id);
      if (!S.profile()) return opts.onClose();
      coach(app, opts);
    };
  });
  $('[data-new]', body).onclick = opts.onAddReader;
  $('[data-export]', body).onclick = () => {
    const blob = new Blob([JSON.stringify(S.all(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sound-squad-backup-${S.today()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('[data-import]', body).onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (!confirm('Replace all progress on this device with this backup?')) return;
      S.replaceAll(data);
      opts.applySettings();
      toast('Backup restored');
      coach(app, opts);
    } catch (err) {
      toast(err.message || 'That file could not be read.', 3000);
    }
  };
}
