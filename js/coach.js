// Coach's Clipboard — the grown-up side: progress, checkpoints, sound map, goals, work samples,
// voice & video, word lists and stories, settings, readers and backups.
import * as S from './store.js';
import { SKILLS, SKILL_INFO, GOAL_MEASURES, measureNow, soundAccuracy, focusSounds } from './store.js';
import { LEVEL_NAME, LEVEL_COUNTS, SOUNDS, SOUND_GROUPS, TWIN_LEVELS, parseWord, autoSpec, chunkPhrases, keyLabel } from './data.js';
import { say, stop, voices, getClip, putClip, deleteClip, clipKeys, playBlob, playVideoBubble, record, tileText, recognitionSupported } from './speech.js';
import { $, esc, lineChart, toast } from './ui.js';

const TABS = [
  ['progress', '📈 Progress'], ['checkpoints', '📏 Checkpoints'], ['sounds', '🗺️ Sound map'], ['goals', '🎯 Goals'],
  ['work', '🎧 Recordings & writing'], ['voice', '🎙️ Voice & video'], ['words', '📚 Words & stories'],
  ['settings', '⚙️ Settings'], ['squad', '👥 Readers & backup'],
];
let tab = 'progress';
const day = 864e5;
const fmtDate = t => new Date(t).toLocaleDateString();

export function coach(app, opts) {
  stop();
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
  ({ progress, checkpoints, sounds, goals, work, voice, words, settings, squad })[tab](body, p, app, opts);
}

// ---------- shared helpers ----------
const sessionsFor = (p, skill, since = 0) => p.sessions.filter(s => s.skill === skill && s.t >= since);
const SERIES_LABEL = { ran: 'items named per minute', memory: 'longest routine remembered', fluency: 'words correct per minute' };

function skillSeries(p, skill) {
  const ss = sessionsFor(p, skill);
  if (SERIES_LABEL[skill]) return ss.filter(s => s.metric != null).map(s => ({ x: s.t, y: s.metric }));
  return ss.filter(s => s.items).map(s => ({ x: s.t, y: Math.round((s.correct / s.items) * 100) }));
}
const accOf = ss => {
  const items = ss.reduce((n, s) => n + s.items, 0);
  return items ? Math.round((ss.reduce((n, s) => n + s.correct, 0) / items) * 100) : null;
};

function explainError(key) {
  const [kind, rest] = key.split(':');
  const strip = s => s.replace(/\(.*\)/, '').replace('*', '');
  if (kind === 'letters') { const [want, got] = rest.split('>'); return `Looking for “${want}”, tapped “${got}”`; }
  if (kind === 'spell') {
    const [want, got] = rest.split('>');
    return `Spelling: needed “${strip(want)}” (${tileText({ key: want, label: strip(want), silent: want === 'e*' })}), picked “${got}”`;
  }
  if (kind === 'phon') {
    return { first: 'Matching first sounds', last: 'Matching last sounds', middle: 'Matching middle (vowel) sounds', count: 'Counting sounds in a word', elideFirst: 'Taking away the first sound', elideLast: 'Taking away the last sound', elideMiddle: 'Taking away a middle sound' }[rest] || rest;
  }
  if (kind === 'decode') return rest === 'syllables' ? 'Clapping syllables in long words' : `Made-up word: read “${rest.split('>')[0]}” as “${rest.split('>')[1]}”`;
  if (kind === 'write') return `Writing: ${rest}`;
  if (kind === 'math') return `Math: ${rest}`;
  return key;
}

const MOODS = { great: '😄', good: '🙂', okay: '😐', hard: '😣' };

function focusStats(p) {
  const since = Date.now() - 30 * day;
  const ss = p.sessions.filter(s => s.t >= since);
  const quits = p.quits.filter(q => q.t >= since);
  const days = new Set(ss.map(s => S.today(s.t))).size;
  const mins = ss.reduce((n, s) => n + s.ms, 0) / 60000;
  const tod = { morning: 0, afternoon: 0, evening: 0 };
  ss.forEach(s => { const h = new Date(s.t).getHours(); tod[h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening']++; });
  const perSkill = SKILLS.map(k => {
    const list = ss.filter(s => s.skill === k);
    return { k, n: list.length, avg: list.length ? list.reduce((n, s) => n + s.ms, 0) / list.length / 60000 : 0, quits: quits.filter(q => q.skill === k).length, acc: accOf(list) };
  });
  const moods = p.moods.filter(m => m.t >= Date.now() - 14 * day);
  return { days, minsPerDay: days ? mins / days : 0, tod, perSkill, quits: quits.length, moods };
}

// ---------- Progress ----------
function progress(body, p, app, opts) {
  const weekAgo = Date.now() - 7 * day;
  const daysWeek = p.days.filter(d => new Date(d + 'T12:00:00').getTime() >= weekAgo).length;
  const minutes = Math.round(p.sessions.reduce((n, s) => n + (s.ms || 0), 0) / 60000);
  const errors = Object.entries(p.errors).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const comeback = Object.keys(p.comeback || {}).map(s => parseWord(s).word);
  const mastered = (p.mastered || []).map(s => parseWord(s).word);
  const f = focusStats(p);
  const moodCounts = Object.keys(MOODS).map(m => [m, f.moods.filter(x => x.mood === m).length]);
  const hardShare = f.moods.length ? f.moods.filter(m => m.mood === 'hard').length / f.moods.length : 0;
  const bestTime = Object.entries(f.tod).sort((a, b) => b[1] - a[1])[0];

  body.innerHTML = `
    <div class="row left"><button class="btn primary" data-weekly>🗓️ Weekly summary</button><button class="btn" data-print>🖨️ Full progress report</button></div>
    <div class="stats">
      <div class="stat-card"><b>${p.days.length}</b><span>days practiced</span></div>
      <div class="stat-card"><b>${daysWeek}</b><span>days this week</span></div>
      <div class="stat-card"><b>${minutes}</b><span>minutes total</span></div>
      <div class="stat-card"><b>${S.streak(p)}</b><span>day goal streak</span></div>
      <div class="stat-card"><b>${p.goalDays.filter(d => new Date(d + 'T12:00:00').getTime() >= weekAgo).length}</b><span>goal met, last 7 days</span></div>
      <div class="stat-card"><b>${p.sessions.length}</b><span>activities done</span></div>
    </div>
    <p class="muted small">Aim for short, frequent practice: 10–15 minutes, 4–5 days a week, beats one long session.</p>

    <div class="two-col">
      <article class="card">
        <h3>🧠 Focus and attention (last 30 days)</h3>
        <p class="small">About <b>${f.minsPerDay.toFixed(1)} minutes</b> per practice day · stopped early <b>${f.quits}</b> time${f.quits === 1 ? '' : 's'}${f.days ? ` · practices most in the <b>${bestTime[0]}</b>` : ''}.</p>
        <table class="mini"><thead><tr><th>Activity</th><th>Times</th><th>Avg min</th><th>Stopped early</th><th>First-try %</th></tr></thead><tbody>
          ${f.perSkill.filter(x => x.n || x.quits).map(x => `<tr><td>${SKILL_INFO[x.k].emoji} ${esc(SKILL_INFO[x.k].title)}</td><td>${x.n}</td><td>${x.avg.toFixed(1)}</td><td>${x.quits || ''}</td><td>${x.acc ?? '—'}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">No practice yet.</td></tr>'}
        </tbody></table>
        <p class="small muted">If one activity gets stopped early a lot, try it earlier in the day, or lower its level.</p>
      </article>
      <article class="card">
        <h3>💬 How practice felt (last 14 days)</h3>
        <div class="moods">${moodCounts.map(([m, n]) => `<span class="mood-count"><span>${MOODS[m]}</span><b>${n}</b></span>`).join('')}</div>
        ${hardShare >= 0.4 && f.moods.length >= 3 ? '<p class="small warn">Practice has felt hard a lot lately. Consider the short routine, lowering a level, or a fun-only day.</p>' : '<p class="small muted">Asked at the end of each daily routine.</p>'}
        <p class="small">${f.moods.slice(-7).map(m => `${MOODS[m.mood]} <span class="muted">${new Date(m.t).toLocaleDateString(undefined, { weekday: 'short' })}</span>`).join(' · ') || ''}</p>
      </article>
    </div>

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
      <div class="row left"><textarea data-note rows="2" placeholder="e.g. Read ‘The Flip Contest’ with expression today!"></textarea><button class="btn" data-addnote>Add note</button></div>
      <ul class="notes">${[...(p.notes || [])].reverse().map(n => `<li><span class="muted small">${esc(fmtDate(n.t))}</span> ${esc(n.text)}</li>`).join('')}</ul>
    </article>`;

  body.querySelectorAll('[data-level]').forEach(sel => {
    sel.onchange = () => { p.levels[sel.dataset.level] = +sel.value; p.recent[sel.dataset.level] = []; S.save(); toast('Level changed'); };
  });
  $('[data-addnote]', body).onclick = () => {
    const ta = $('[data-note]', body);
    if (!ta.value.trim()) return;
    p.notes.push({ t: Date.now(), text: ta.value.trim() });
    S.save();
    progress(body, p, app, opts);
  };
  $('[data-print]', body).onclick = () => printReport(p);
  $('[data-weekly]', body).onclick = () => weekly(body, p, app, opts);
}

// ---------- Weekly summary ----------
function weeklyData(p) {
  const now = Date.now();
  const wk = now - 7 * day;
  const prevWk = now - 14 * day;
  const thisW = p.sessions.filter(s => s.t >= wk);
  const lastW = p.sessions.filter(s => s.t >= prevWk && s.t < wk);
  const days = new Set(thisW.map(s => S.today(s.t))).size;
  const mins = Math.round(thisW.reduce((n, s) => n + s.ms, 0) / 60000);
  const rows = SKILLS.map(k => {
    const a = thisW.filter(s => s.skill === k);
    const b = lastW.filter(s => s.skill === k);
    const metric = list => { const m = list.filter(s => s.metric != null).map(s => s.metric); return m.length ? Math.max(...m) : null; };
    return { k, n: a.length, acc: accOf(a), accPrev: accOf(b), metric: metric(a), metricPrev: metric(b), level: p.levels[k] };
  }).filter(r => r.n);
  const errs = {};
  // Errors aren't timestamped; show the overall top three as current focus.
  Object.entries(p.errors).sort((x, y) => y[1] - x[1]).slice(0, 3).forEach(([k, n]) => { errs[k] = n; });
  const moods = p.moods.filter(m => m.t >= wk).map(m => MOODS[m.mood]).join(' ');
  const sentences = p.journal.filter(j => j.t >= wk);
  const recs = p.readings.filter(r => r.t >= wk);
  const goalsTxt = p.goals.map(g => `${g.text}: ${measureNow(p, g.measure) ?? (g.done ? 'done' : '—')} / ${g.target ?? ''}`);
  const goalDays = p.goalDays.filter(d => new Date(d + 'T12:00:00').getTime() >= wk).length;
  return { days, goalDays, mins, rows, errs, moods, sentences, recs, goalsTxt, from: wk, to: now };
}

function weeklyText(p, w) {
  const lines = [
    `Sound Squad weekly summary for ${p.name} (${fmtDate(w.from)} – ${fmtDate(w.to)})`,
    `Practiced ${w.days} day${w.days === 1 ? '' : 's'}, ${w.mins} minutes. Daily goal (${S.DAILY_GOALS[p.settings.dailyGoal]}) met on ${w.goalDays} day${w.goalDays === 1 ? '' : 's'}.`,
    ...w.rows.map(r => `• ${SKILL_INFO[r.k].title} (level ${r.level}): ${r.n}×${r.acc != null ? `, ${r.acc}% first try${r.accPrev != null ? ` (last week ${r.accPrev}%)` : ''}` : ''}${r.metric != null ? `, best ${r.metric} ${SERIES_LABEL[r.k] || ''}` : ''}`),
    Object.keys(w.errs).length ? `Working on: ${Object.keys(w.errs).map(explainError).join('; ')}.` : '',
    w.sentences.length ? `Sentences written: ${w.sentences.map(s => `"${s.text}"`).join(' ')}` : '',
    w.recs.length ? `${w.recs.length} reading recording${w.recs.length === 1 ? '' : 's'} saved.` : '',
    w.moods ? `How it felt: ${w.moods}` : '',
    w.goalsTxt.length ? `Goals: ${w.goalsTxt.join('; ')}` : '',
  ];
  return lines.filter(Boolean).join('\n');
}

function weekly(body, p, app, opts) {
  const w = weeklyData(p);
  const text = weeklyText(p, w);
  body.innerHTML = `
    <div class="row left"><button class="btn" data-back>← Back</button><button class="btn primary" data-share>📤 Share / email</button><button class="btn" data-copy>📋 Copy text</button><button class="btn" data-printw>🖨️ Print</button></div>
    <article class="card weekly">
      <h2>Week of ${esc(fmtDate(w.from))} – ${esc(fmtDate(w.to))}</h2>
      <p><b>${w.days}</b> practice days · daily goal met <b>${w.goalDays}</b> day${w.goalDays === 1 ? '' : 's'} · <b>${w.mins}</b> minutes ${w.moods ? `· felt: ${w.moods}` : ''}</p>
      <table class="mini"><thead><tr><th>Activity</th><th>Level</th><th>Times</th><th>First-try %</th><th>Last week</th><th>Best score</th></tr></thead><tbody>
        ${w.rows.map(r => `<tr><td>${SKILL_INFO[r.k].emoji} ${esc(SKILL_INFO[r.k].title)}</td><td>${r.level}</td><td>${r.n}</td><td>${r.acc ?? '—'}</td><td>${r.accPrev ?? '—'}</td><td>${r.metric ?? '—'}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">No practice this week.</td></tr>'}
      </tbody></table>
      ${Object.keys(w.errs).length ? `<p class="small"><b>Working on:</b> ${Object.keys(w.errs).map(k => esc(explainError(k))).join('; ')}</p>` : ''}
      ${w.sentences.length ? `<p class="small"><b>Sentences written:</b> ${w.sentences.map(s => `“${esc(s.text)}”`).join(' ')}</p>` : ''}
      ${w.goalsTxt.length ? `<p class="small"><b>Goals:</b> ${w.goalsTxt.map(esc).join('; ')}</p>` : ''}
    </article>
    <p class="muted small">Share opens your device's share sheet (email, messages) so you choose who gets it. Nothing is sent automatically.</p>`;
  $('[data-back]', body).onclick = () => progress(body, p, app, opts);
  $('[data-copy]', body).onclick = async () => { try { await navigator.clipboard.writeText(text); toast('Copied'); } catch { toast('Copy not allowed here'); } };
  $('[data-share]', body).onclick = async () => {
    if (navigator.share) { try { await navigator.share({ title: `${p.name}'s week in Sound Squad`, text }); } catch { /* cancelled */ } }
    else { location.href = `mailto:?subject=${encodeURIComponent(`${p.name}'s reading practice this week`)}&body=${encodeURIComponent(text)}`; }
  };
  $('[data-printw]', body).onclick = () => {
    document.getElementById('print').innerHTML = `<h1>Weekly summary</h1>${$('.weekly', body).innerHTML}`;
    window.print();
  };
}

// ---------- Full report ----------
function printReport(p) {
  const first = p.sessions[0]?.t;
  const rows = SKILLS.map(k => {
    const series = skillSeries(p, k);
    const unit = SERIES_LABEL[k] || '% first-try accuracy';
    return `<tr><td>${esc(SKILL_INFO[k].title)}</td><td>${p.levels[k]}. ${esc(LEVEL_NAME[k](p.levels[k]) || '')}</td><td>${sessionsFor(p, k).length}</td>
      <td>${series[0]?.y ?? '—'}</td><td>${series[series.length - 1]?.y ?? '—'}</td><td>${esc(unit)}</td></tr>`;
  }).join('');
  const cps = p.checkpoints.map(c => `<tr><td>${esc(fmtDate(c.t))}</td><td>${c.sounds.correct}/${c.sounds.total}</td><td>${c.words.rate}</td><td>${c.nonwords.rate}</td><td>${c.spelling.correct}/10</td><td>${c.reading.wcpm} (${Math.round(c.reading.accuracy * 100)}%)</td></tr>`).join('');
  const reads = Object.entries(p.readHistory || {}).map(([id, h]) => `<li>${esc(id)}: ${h.map(x => x.wcpm).join(' → ')} words correct/min</li>`).join('');
  const errors = Object.entries(p.errors).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `<li>${esc(explainError(k))} (×${n})</li>`).join('');
  const goalsHtml = p.goals.map(g => `<li>${esc(g.text)}: now ${esc(String(measureNow(p, g.measure) ?? (g.done ? 'done' : '—')))}, target ${esc(String(g.target ?? '—'))}${g.by ? ` by ${esc(g.by)}` : ''}</li>`).join('');
  const weak = focusSounds(p).map(keyLabel);
  const f = focusStats(p);
  document.getElementById('print').innerHTML = `
    <h1>Sound Squad progress report</h1>
    <p><b>${esc(p.name)}</b> · printed ${esc(fmtDate(Date.now()))}${first ? ` · practicing since ${esc(fmtDate(first))}` : ''}</p>
    <p>${p.days.length} practice days · ${Math.round(p.sessions.reduce((n, s) => n + (s.ms || 0), 0) / 60000)} minutes · ${p.sessions.length} activities · ${f.minsPerDay.toFixed(1)} min per practice day (last 30 days)</p>
    <h2>Monthly checkpoints</h2>
    ${cps ? `<table><thead><tr><th>Date</th><th>Letter sounds</th><th>Real words/min</th><th>Made-up words/min</th><th>Spelling</th><th>Story words correct/min (accuracy)</th></tr></thead><tbody>${cps}</tbody></table>` : '<p>None yet.</p>'}
    <h2>Goals</h2><ul>${goalsHtml || '<li>None set</li>'}</ul>
    <h2>Practice by skill</h2>
    <table><thead><tr><th>Activity</th><th>Current level</th><th>Sessions</th><th>First</th><th>Latest</th><th>Measure</th></tr></thead><tbody>${rows}</tbody></table>
    <h2>Sounds to focus on</h2><p>${weak.length ? weak.map(esc).join(', ') : 'None flagged'}</p>
    <h2>Repeated reading (words correct per minute)</h2><ul>${reads || '<li>None yet</li>'}</ul>
    <h2>Most frequent mix-ups</h2><ul>${errors || '<li>None recorded</li>'}</ul>
    <h2>Mastered spelling words</h2><p>${(p.mastered || []).map(s => esc(parseWord(s).word)).join(', ') || 'None yet'}</p>
    <h2>Recent sentences written</h2><ul>${p.journal.slice(-10).map(j => `<li>${esc(fmtDate(j.t))}: ${esc(j.text)}</li>`).join('') || '<li>None yet</li>'}</ul>
    <h2>Coach notes</h2><ul>${(p.notes || []).map(n => `<li>${esc(fmtDate(n.t))}: ${esc(n.text)}</li>`).join('') || '<li>None</li>'}</ul>
    <p class="small">Home practice data from the Sound Squad app. These are practice measures, not standardized test scores.</p>`;
  window.print();
}

// ---------- Checkpoints ----------
function checkpoints(body, p, app, opts) {
  const cps = p.checkpoints;
  const last = cps[cps.length - 1];
  const series = f => cps.map(c => ({ x: c.t, y: f(c) }));
  const due = !last || Date.now() - last.t > 28 * day;
  body.innerHTML = `
    <article class="card">
      <h3>Monthly checkpoint</h3>
      <p class="small">A 10-minute check with the <b>same lists every time</b>: letter sounds, a 1-minute real-word list, a 1-minute made-up-word list, 10 spelling words, and a recorded story reading. Do one now as a starting point, then once a month.</p>
      <p class="small">${last ? `Last checkpoint: <b>${esc(fmtDate(last.t))}</b>. ${due ? 'A new one is due.' : `Next one after ${esc(fmtDate(last.t + 28 * day))}.`}` : 'No checkpoint yet.'}</p>
      <button class="btn primary big" data-start>📏 Start a checkpoint</button>
    </article>
    ${cps.length ? `
    <article class="card">
      <h3>Results</h3>
      <table class="mini"><thead><tr><th>Date</th><th>Letter sounds</th><th>Real words/min</th><th>Made-up words/min</th><th>Spelling</th><th>Story wcpm</th><th>Story accuracy</th></tr></thead><tbody>
        ${cps.map(c => `<tr><td>${esc(fmtDate(c.t))}</td><td>${c.sounds.correct}/${c.sounds.total}</td><td>${c.words.rate}</td><td>${c.nonwords.rate}</td><td>${c.spelling.correct}/10</td><td>${c.reading.wcpm}</td><td>${Math.round(c.reading.accuracy * 100)}%</td></tr>`).join('')}
      </tbody></table>
    </article>
    <div class="skill-cards">
      <article class="card skill" style="--c:#0f766e"><h3>Real words per minute</h3>${lineChart(series(c => c.words.rate), { color: '#0f766e' })}</article>
      <article class="card skill" style="--c:#0e9f9a"><h3>Made-up words per minute</h3>${lineChart(series(c => c.nonwords.rate), { color: '#0e9f9a' })}</article>
      <article class="card skill" style="--c:#ff7a1a"><h3>Story words correct per minute</h3>${lineChart(series(c => c.reading.wcpm), { color: '#ff7a1a' })}</article>
      <article class="card skill" style="--c:#e2366b"><h3>Letter sounds correct</h3>${lineChart(series(c => c.sounds.correct), { color: '#e2366b' })}</article>
      <article class="card skill" style="--c:#7a3ff2"><h3>Spelling (of 10)</h3>${lineChart(series(c => c.spelling.correct), { color: '#7a3ff2', min: 0, max: 10 })}</article>
    </div>
    <article class="card">
      <h3>Latest checkpoint details (${esc(fmtDate(last.t))})</h3>
      <p class="small"><b>Sounds missed:</b> ${last.sounds.missed.map(esc).join(', ') || 'none'}</p>
      <p class="small"><b>Real words missed:</b> ${last.words.missed.map(esc).join(', ') || 'none'}</p>
      <p class="small"><b>Made-up words missed:</b> ${last.nonwords.missed.map(esc).join(', ') || 'none'}</p>
      <p class="small"><b>Spelling misses:</b> ${last.spelling.missed.map(m => `${esc(m.word)}${m.wrote ? ` (wrote “${esc(m.wrote)}”)` : ''}`).join(', ') || 'none'}</p>
      <p class="small"><b>Story words missed:</b> ${last.reading.missed.map(esc).join(', ') || 'none'}</p>
    </article>` : ''}`;
  $('[data-start]', body).onclick = opts.onCheckpoint;
}

// ---------- Sound map ----------
function sounds(body, p, app, opts) {
  const color = k => {
    const a = soundAccuracy(p, k);
    if (a == null) return 'none';
    return a >= 0.9 ? 'strong' : a >= 0.7 ? 'growing' : 'focus';
  };
  const watch = new Set(p.watch);
  const draw = () => {
    body.innerHTML = `
      <article class="card">
        <h3>Sound map</h3>
        <p class="small">Every letter sound, colored by how often it's right in spelling practice and checkpoints (after 3 tries). <b>Tap a sound to add a ⭐</b> — starred sounds (like ones the evaluation or therapist flagged) are mixed into spelling practice more often.</p>
        <div class="legend"><span class="sm strong">strong 90%+</span><span class="sm growing">growing 70–89%</span><span class="sm focus">focus under 70%</span><span class="sm none">not enough data</span></div>
      </article>
      ${SOUND_GROUPS.map(g => `
        <article class="card"><h3>${esc(g.name)}</h3>
          <div class="sound-map">${g.keys.map(k => {
            const s = p.soundStats[k];
            const a = soundAccuracy(p, k);
            return `<button class="sm ${color(k)} ${watch.has(k) ? 'watched' : ''}" data-k="${esc(k)}" title="${s ? `${s.h} right, ${s.m} missed` : 'no data yet'}">
              <b>${esc(keyLabel(k))}</b><small>${SOUNDS[k] ? esc(SOUNDS[k][0]) : ''}</small><small>${a == null ? '' : Math.round(a * 100) + '%'}</small>${watch.has(k) ? '<i>⭐</i>' : ''}</button>`;
          }).join('')}</div>
        </article>`).join('')}
      <article class="card"><h3>Focus sounds right now</h3><p class="words">${focusSounds(p).map(k => esc(keyLabel(k))).join(', ') || '<span class="muted small">None yet.</span>'}</p></article>`;
    body.querySelectorAll('[data-k]').forEach(b => {
      b.onclick = () => {
        const k = b.dataset.k;
        if (watch.has(k)) watch.delete(k); else watch.add(k);
        p.watch = [...watch];
        S.save();
        draw();
      };
    });
  };
  draw();
}

// ---------- Goals ----------
function goals(body, p, app, opts) {
  body.innerHTML = `
    <article class="card form">
      <h3>Add a goal</h3>
      <p class="small muted">Use goals from the therapist or school plan, e.g. “Read 60 words correct per minute by May.”</p>
      <label>What to measure <select data-m>${Object.entries(GOAL_MEASURES).map(([k, g]) => `<option value="${k}">${esc(g.label)}</option>`).join('')}</select></label>
      <label>Target <input data-target type="number" min="0" inputmode="numeric"></label>
      <label>By (optional) <input data-by type="date"></label>
      <label>Describe it (optional) <input data-text maxlength="80" placeholder="e.g. Read 60 words a minute by May"></label>
      <button class="btn primary" data-add>Add goal</button>
    </article>
    <div class="goal-list">${p.goals.map((g, i) => {
      const now = measureNow(p, g.measure);
      const pctDone = g.measure === 'custom' ? (g.done ? 100 : 0) : (now != null && g.target ? Math.min(100, Math.round(((now - (g.start ?? 0)) / Math.max(1, g.target - (g.start ?? 0))) * 100)) : 0);
      const reached = g.measure === 'custom' ? g.done : now != null && now >= g.target;
      return `<article class="card goal ${reached ? 'reached' : ''}">
        <header><h3>${reached ? '🏆 ' : '🎯 '}${esc(g.text)}</h3><button class="btn small" data-del="${i}">Remove</button></header>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.max(0, pctDone)}%"></div></div>
        <p class="small">${g.measure === 'custom'
          ? `<label class="check"><input type="checkbox" data-done="${i}" ${g.done ? 'checked' : ''}> Done</label>`
          : `Started at <b>${g.start ?? '—'}</b> · now <b>${now ?? '—'}</b> · target <b>${g.target}</b> ${esc(GOAL_MEASURES[g.measure].unit)}`}
          ${g.by ? ` · by ${esc(new Date(g.by + 'T12:00:00').toLocaleDateString())}` : ''} · set ${esc(fmtDate(g.created))}</p>
      </article>`;
    }).join('') || '<p class="muted">No goals yet.</p>'}</div>`;
  $('[data-add]', body).onclick = () => {
    const measure = $('[data-m]', body).value;
    const target = $('[data-target]', body).value === '' ? null : +$('[data-target]', body).value;
    if (measure !== 'custom' && target == null) { toast('Add a target number.'); return; }
    const text = $('[data-text]', body).value.trim() || `${GOAL_MEASURES[measure].label}${target != null ? `: ${target}` : ''}`;
    p.goals.push({ measure, target, by: $('[data-by]', body).value || null, text, created: Date.now(), start: measureNow(p, measure), done: false });
    S.save();
    goals(body, p, app, opts);
  };
  body.querySelectorAll('[data-del]').forEach(b => { b.onclick = () => { p.goals.splice(+b.dataset.del, 1); S.save(); goals(body, p, app, opts); }; });
  body.querySelectorAll('[data-done]').forEach(c => { c.onchange = () => { p.goals[+c.dataset.done].done = c.checked; S.save(); goals(body, p, app, opts); }; });
}

// ---------- Recordings & writing ----------
function work(body, p, app, opts) {
  const byStory = {};
  p.readings.forEach(r => { (byStory[r.title] = byStory[r.title] || []).push(r); });
  body.innerHTML = `
    <article class="card">
      <h3>🎧 Reading recordings</h3>
      <p class="small">Recordings are saved when “Save a recording” is on during <i>Read it myself</i>, and during every checkpoint. Play the first and latest back to back to hear the growth. They stay on this device only.</p>
      ${Object.keys(byStory).length ? Object.entries(byStory).map(([title, list]) => `
        <div class="rec-story">
          <h4>${esc(title)}</h4>
          ${list.length >= 2 ? `<button class="btn small primary" data-compare="${esc(title)}">▶ Compare first and latest</button>` : ''}
          <ul class="notes">${list.map(r => `<li><button class="btn small" data-play="${esc(r.key)}">▶</button> ${esc(fmtDate(r.t))} · <b>${r.wcpm}</b> words/min · ${Math.round((r.accuracy ?? 0) * 100)}% <button class="btn small" data-rmrec="${esc(r.key)}">Delete</button></li>`).join('')}</ul>
        </div>`).join('') : '<p class="muted small">No recordings yet.</p>'}
    </article>
    <article class="card">
      <h3>✏️ Sentence journal</h3>
      <p class="small muted">Every sentence built in Sentence Builder. ✏️ means it was copied on paper too.</p>
      ${p.journal.length ? `<ul class="notes journal">${[...p.journal].reverse().map(j => `<li><span class="muted small">${esc(fmtDate(j.t))}</span> ${esc(j.text)} ${j.copied ? '✏️' : ''}</li>`).join('')}</ul>
        <button class="btn" data-printj>🖨️ Print journal</button>` : '<p class="muted small">No sentences yet.</p>'}
    </article>`;
  const play = async key => { const b = await getClip(key); if (b) return playBlob(b); toast('That recording is missing.'); return true; };
  body.querySelectorAll('[data-play]').forEach(b => { b.onclick = () => play(b.dataset.play); });
  body.querySelectorAll('[data-compare]').forEach(b => {
    b.onclick = async () => {
      const list = byStory[b.dataset.compare];
      toast(`First: ${fmtDate(list[0].t)}`, 2500);
      if (!(await play(list[0].key))) return;
      toast(`Latest: ${fmtDate(list[list.length - 1].t)}`, 2500);
      await play(list[list.length - 1].key);
    };
  });
  body.querySelectorAll('[data-rmrec]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Delete this recording? It cannot be undone.')) return;
      await deleteClip(b.dataset.rmrec);
      p.readings = p.readings.filter(r => r.key !== b.dataset.rmrec);
      S.save();
      work(body, p, app, opts);
    };
  });
  $('[data-printj]', body)?.addEventListener('click', () => {
    document.getElementById('print').innerHTML = `<h1>${esc(p.name)}'s sentence journal</h1><ul>${p.journal.map(j => `<li>${esc(fmtDate(j.t))}: ${esc(j.text)}</li>`).join('')}</ul>`;
    window.print();
  });
}

// ---------- Voice & video ----------
async function recordVideoModal(title) {
  const box = document.createElement('div');
  box.className = 'modal';
  box.innerHTML = `<div class="modal-card"><h3>${esc(title)}</h3><video class="preview" autoplay playsinline muted></video>
    <p class="small muted">Up to 15 seconds. Face the camera, close up.</p>
    <div class="row"><button class="btn" data-cancel>Cancel</button><button class="btn primary big" data-stop>■ Stop</button></div></div>`;
  document.body.appendChild(box);
  let stopper;
  try { stopper = await record({ video: box.querySelector('video') }); } catch {
    box.remove();
    toast('Camera not available. Check the browser permission.', 3000);
    return null;
  }
  const blob = await new Promise(resolve => {
    const t = setTimeout(() => stopper().then(resolve), 15000);
    box.querySelector('[data-stop]').onclick = () => { clearTimeout(t); stopper().then(resolve); };
    box.querySelector('[data-cancel]').onclick = () => { clearTimeout(t); stopper().then(() => resolve(null)); };
  });
  box.remove();
  return blob;
}

async function voice(body) {
  const have = new Set(await clipKeys());
  const pairs = [...new Set(TWIN_LEVELS.flatMap(l => l.pairs.map(pr => [...pr].sort().join('/'))))];
  body.innerHTML = `
    <article class="card">
      <h3>Record the sounds in your own voice</h3>
      <p class="small">Computer voices can't say a pure letter sound like /b/ — they say “bee, as in bat.” Record the real sound (short and crisp: “/b/”, not “buh”) and the app uses <b>your voice</b>. Add a 🎥 <b>mouth video</b> too: seeing lips and tongue helps with sounds that are easy to mix up (like short e and short i). Recordings stay on this device.</p>
      <p class="small muted">● records voice (tap again to stop). 🎥 records a short video. ▶ plays what the app will use.</p>
    </article>
    ${SOUND_GROUPS.map(g => `
      <article class="card">
        <h3>${esc(g.name)}</h3>
        <div class="rec-grid">${g.keys.map(k => {
          const id = `sound:${k}`;
          const vid = `video:sound:${k}`;
          return `<div class="rec ${have.has(id) || have.has(vid) ? 'has' : ''}" data-key="${esc(id)}" data-tile="${esc(k)}">
            <b>${esc(keyLabel(k))}</b><span class="small muted">as in ${esc(SOUNDS[k]?.[0] || '')}${have.has(vid) ? ' · 🎥' : ''}</span>
            <div class="rec-btns"><button class="btn small" data-act="play" aria-label="Play">▶</button><button class="btn small rec-btn" data-act="rec" aria-label="Record voice">●</button><button class="btn small" data-act="vid" aria-label="Record video">🎥</button><button class="btn small" data-act="del" aria-label="Delete" ${have.has(id) || have.has(vid) ? '' : 'disabled'}>✕</button></div>
          </div>`;
        }).join('')}</div>
      </article>`).join('')}
    <article class="card">
      <h3>🎥 Cheer move videos (Mirror Twins)</h3>
      <p class="small">Film yourself (or your reader!) doing the cheer move for each look-alike pair — like the thumbs-up “bed” for b and d. It plays when that pair comes up.</p>
      <div class="rec-grid">${pairs.map(pr => `<div class="rec ${have.has('video:move:' + pr) ? 'has' : ''}" data-move="${esc(pr)}"><b>${esc(pr.replace('/', ' / '))}</b>
        <div class="rec-btns"><button class="btn small" data-mv="play">▶</button><button class="btn small" data-mv="rec">🎥</button><button class="btn small" data-mv="del" ${have.has('video:move:' + pr) ? '' : 'disabled'}>✕</button></div></div>`).join('')}</div>
    </article>`;

  let stopper = null;
  body.onclick = async e => {
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const row = mv.closest('[data-move]');
      const key = `video:move:${row.dataset.move}`;
      if (mv.dataset.mv === 'play') { const b = await getClip(key); if (b) playVideoBubble(b, { big: true }); else toast('No video yet.'); }
      if (mv.dataset.mv === 'del') { await deleteClip(key); voice(body); }
      if (mv.dataset.mv === 'rec') {
        const blob = await recordVideoModal(`Cheer move: ${row.dataset.move.replace('/', ' and ')}`);
        if (blob) { await putClip(key, blob); voice(body); }
      }
      return;
    }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const row = b.closest('.rec');
    const key = row.dataset.key;
    const tileKey = row.dataset.tile;
    const tile = { key: tileKey, label: keyLabel(tileKey) };
    if (b.dataset.act === 'play') {
      const v = await getClip(`video:${key}`);
      if (v) { playVideoBubble(v); return; }
      const clip = await getClip(key);
      if (clip) playBlob(clip); else say(tileText(tile));
    } else if (b.dataset.act === 'del') {
      await deleteClip(key);
      await deleteClip(`video:${key}`);
      voice(body);
    } else if (b.dataset.act === 'vid') {
      const blob = await recordVideoModal(`Mouth video: ${keyLabel(tileKey)} (as in ${SOUNDS[tileKey]?.[0] || ''})`);
      if (blob) { await putClip(`video:${key}`, blob); voice(body); }
    } else if (b.dataset.act === 'rec') {
      if (stopper) {
        const blob = await stopper();
        stopper = null;
        const active = body.querySelector('.rec-btn.on');
        const r = active?.closest('.rec');
        if (r) { await putClip(r.dataset.key, blob); playBlob(blob); }
        voice(body);
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

// ---------- Words & stories ----------
function words(body, p, app, opts) {
  const listText = (p.customWords || []).map(s => parseWord(s).word).join('\n');
  body.innerHTML = `
    <article class="card form">
      <h3>This week's spelling words</h3>
      <p class="small">Type the words from the therapist or lesson plan (one per line). When turned on, <i>Give Me a Sound!</i> practices these instead of its own list, so home practice matches lessons.</p>
      <textarea data-list rows="6" placeholder="ship&#10;chop&#10;rain&#10;…">${esc(listText)}</textarea>
      <div class="tile-preview" data-preview></div>
      <p class="small muted">Check the tiles: each box is one sound. Fix a split by typing it with dashes, e.g. <code>sh-ee-p</code>, and <code>e*</code> for a silent e.</p>
      <label class="check"><input type="checkbox" data-use ${p.settings.useCustomWords ? 'checked' : ''}> Use this list in Give Me a Sound!</label>
      <button class="btn primary" data-savelist>Save word list</button>
    </article>
    <article class="card form">
      <h3>Add your own story</h3>
      <p class="small">Paste a passage from your lessons, a library book, or a note you wrote. The app breaks it into short “scoops,” reads it aloud, and times repeated readings. (Tip: <i>📷 Read Anything</i> on the home screen can photograph a page.)</p>
      <label>Title <input data-title maxlength="60"></label>
      <label>Text <textarea data-text rows="6"></textarea></label>
      <button class="btn primary" data-add>Add story</button>
    </article>
    <article class="card">
      <h3>Our stories</h3>
      ${p.stories.length ? `<ul class="notes">${p.stories.map(s => `<li><b>${esc(s.title)}</b> <button class="btn small" data-del="${esc(s.id)}">Remove</button></li>`).join('')}</ul>` : '<p class="muted small">None yet. Built-in stories are always available.</p>'}
    </article>`;
  const toSpec = line => (line.includes('-') ? line.trim().toLowerCase() : autoSpec(line));
  const preview = () => {
    const specs = $('[data-list]', body).value.split('\n').map(s => s.trim()).filter(Boolean).map(toSpec).filter(Boolean);
    $('[data-preview]', body).innerHTML = specs.map(s => {
      try { const w = parseWord(s); return `<span class="pv-word">${w.tiles.map(t => `<i class="${t.silent ? 'silent' : ''}">${esc(t.label)}</i>`).join('')}</span>`; } catch { return `<span class="pv-word bad">${esc(s)}?</span>`; }
    }).join('');
    return specs;
  };
  $('[data-list]', body).oninput = preview;
  preview();
  $('[data-savelist]', body).onclick = () => {
    const specs = preview().filter(s => { try { parseWord(s); return true; } catch { return false; } });
    p.customWords = specs;
    p.settings.useCustomWords = $('[data-use]', body).checked && specs.length > 0;
    S.save();
    toast(`Saved ${specs.length} words`);
  };
  $('[data-add]', body).onclick = () => {
    const title = $('[data-title]', body).value.trim();
    const text = $('[data-text]', body).value.trim();
    if (!title || !text) { toast('Add a title and some text.'); return; }
    p.stories.push({ id: 'c' + Date.now().toString(36), title, text: chunkPhrases(text), questions: [], level: 0 });
    S.save();
    toast('Story added');
    words(body, p, app, opts);
  };
  body.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = () => { p.stories = p.stories.filter(s => s.id !== b.dataset.del); S.save(); words(body, p, app, opts); };
  });
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
        <label>Daily goal (keeps the 🔥 streak going)
          <select data-k="dailyGoal">${Object.entries(S.DAILY_GOALS).map(([k, t]) => `<option value="${k}" ${s.dailyGoal === k ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
        <p class="small muted">The streak counts days in a row the goal is met. If a routine is stopped partway, it picks up where it left off next time.</p>
        <label class="check"><input type="checkbox" data-k="breaks" ${s.breaks ? 'checked' : ''}> Stunt breaks (movement between activities)</label>
        <label class="check"><input type="checkbox" data-k="sfx" ${s.sfx ? 'checked' : ''}> Sound effects</label>
        <label class="check"><input type="checkbox" data-k="recordReading" ${s.recordReading ? 'checked' : ''}> Save a recording each time a story is read solo (Read it myself)</label>
        <label class="check"><input type="checkbox" data-k="mic" ${s.mic ? 'checked' : ''} ${recognitionSupported ? '' : 'disabled'}> Speech-to-text (reading check and Sentence Builder talking)</label>
        <p class="small muted">${recognitionSupported
          ? 'Speech-to-text uses the browser’s speech service, which may send audio to Google or Apple to turn it into text. Leave it off to keep everything on this device — a grown-up can type sentences and mark missed words instead. Saved recordings never leave the device.'
          : 'This browser can’t turn speech into text. Try Chrome, Edge or Safari. A grown-up can still type sentences and mark missed words.'}</p>
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
        <p class="small">Save a backup file to keep progress safe or move it to another device. Voice, video and reading recordings are not included — they stay on the device where they were made.</p>
        <div class="row left"><button class="btn primary" data-export>⬇️ Save backup</button>
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
