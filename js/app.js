import * as S from './store.js';
import { SKILLS, SKILL_INFO } from './store.js';
import { LEVEL_NAME, LEVEL_COUNTS, STUNT_BREAKS } from './data.js';
import { say, stop, sfx, configure } from './speech.js';
import { $, esc, pick, sleep, confetti, waitClick, PRAISE } from './ui.js';
import * as ran from './act-ran.js';
import * as letters from './act-letters.js';
import * as phon from './act-phon.js';
import * as spell from './act-spell.js';
import * as memory from './act-memory.js';
import * as fluency from './act-read.js';
import { coach } from './coach.js';

const ACTS = { ran, letters, phon, spell, memory, fluency };
const app = $('#app');
const COLORS = ['#e2366b', '#7a3ff2', '#2b8bd8', '#2aa36b', '#f5b400', '#ff7a1a'];
const FONTS = {
  Lexend: '"Lexend", "Verdana", sans-serif', Verdana: 'Verdana, "Lexend", sans-serif',
  'Comic Sans MS': '"Comic Sans MS", "Comic Neue", "Lexend", sans-serif', Arial: 'Arial, "Helvetica Neue", sans-serif',
};

export function applySettings() {
  const p = S.profile();
  const s = p ? p.settings : S.DEFAULT_SETTINGS;
  const r = document.documentElement.style;
  r.setProperty('--read-font', FONTS[s.font] || FONTS.Lexend);
  r.setProperty('--read-size', s.size + 'px');
  r.setProperty('--read-spacing', s.spacing + 'em');
  r.setProperty('--read-lh', s.lineHeight);
  r.setProperty('--squad', p?.color || '#e2366b');
  document.body.dataset.tint = s.tint;
  configure({ rate: s.rate, voiceURI: s.voiceURI, sfx: s.sfx });
}

// ---------- Setup ----------
function setup({ first = true } = {}) {
  stop();
  app.innerHTML = `
    <div class="page setup">
      <div class="logo">📣</div>
      <h1>${first ? 'Welcome to Sound Squad' : 'Add a reader'}</h1>
      ${first ? `<p class="lead">Reading practice that works like cheer practice: short routines, sound cheers, movement breaks, and a coach's clipboard that tracks progress.</p>` : ''}
      <form class="card form" data-form>
        <label>Reader's first name <input name="name" required maxlength="20" autocomplete="off"></label>
        <label>Grade
          <select name="grade">${['K', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 'Adult'].map(g => `<option value="${g === 'K' ? 0 : g === 'Adult' ? 13 : g}" ${g === 3 ? 'selected' : ''}>${g === 'K' ? 'Kindergarten' : g === 'Adult' ? 'Adult' : 'Grade ' + g}</option>`).join('')}</select>
        </label>
        <fieldset><legend>Squad color</legend>
          <div class="swatches">${COLORS.map((c, i) => `<label class="swatch" style="--c:${c}"><input type="radio" name="color" value="${c}" ${i ? '' : 'checked'}><span></span></label>`).join('')}</div>
        </fieldset>
        <button class="btn primary big">Join the squad!</button>
        ${first ? '' : '<button type="button" class="btn" data-cancel>Cancel</button>'}
      </form>
      <p class="muted small">Everything stays on this device. Nothing is uploaded.</p>
    </div>`;
  const form = $('[data-form]', app);
  form.onsubmit = e => {
    e.preventDefault();
    const f = new FormData(form);
    S.addProfile({ name: f.get('name'), grade: f.get('grade'), color: f.get('color') });
    applySettings();
    home();
  };
  $('[data-cancel]', app)?.addEventListener('click', home);
}

// ---------- Home ----------
function maxStreak(days) {
  const sorted = [...new Set(days)].sort();
  let best = 0; let run = 0; let prev = null;
  for (const d of sorted) {
    const t = new Date(d + 'T12:00:00');
    run = prev && (t - prev) / 864e5 < 1.5 ? run + 1 : 1;
    best = Math.max(best, run);
    prev = t;
  }
  return best;
}

function badges(p) {
  const ms = maxStreak(p.days);
  const reads = Object.values(p.readHistory || {}).reduce((n, h) => n + h.length, 0);
  const levelUps = p.sessions.length && SKILLS.some(k => p.levels[k] > 1);
  return [
    ['🎀', 'First practice', p.days.length >= 1], ['🔥', '3 days in a row', ms >= 3], ['🏆', '7 days in a row', ms >= 7],
    ['⭐', '100 spirit points', p.stars >= 100], ['🌟', '500 spirit points', p.stars >= 500],
    ['📣', '10 mastered words', p.mastered.length >= 10], ['⚡', 'Speed star', Object.keys(p.best).some(k => k.startsWith('ran') && p.best[k] >= 50)],
    ['📚', '5 stories read', reads >= 5], ['🚀', 'Level up!', levelUps],
  ];
}

function routinePlan(p) {
  const prevDays = p.days.filter(d => d !== S.today()).length;
  const odd = prevDays % 2 === 1;
  let plan = p.settings.routine === 'short'
    ? ['phon', 'spell', 'break', 'fluency']
    : ['ran', 'phon', 'break', 'spell', odd ? 'memory' : 'letters', 'break', 'fluency'];
  if (!p.settings.breaks) plan = plan.filter(s => s !== 'break');
  return plan;
}

export function home() {
  stop();
  applySettings();
  const p = S.profile();
  if (!p) return setup();
  const doneToday = p.days.includes(S.today());
  const plan = routinePlan(p);
  const st = S.streak(p);
  app.innerHTML = `
    <div class="page home">
      <header class="topbar">
        <div class="me"><span class="avatar" style="background:${p.color}">${esc(p.name[0]?.toUpperCase())}</span>
          <div><h1>Hi, ${esc(p.name)}!</h1><p class="muted">${st ? `🔥 ${st}-day streak · ` : ''}⭐ ${p.stars} spirit points</p></div></div>
        <div class="top-actions">
          ${S.all().profiles.length > 1 ? '<button class="btn small" data-switch>👥 Switch</button>' : ''}
          <button class="btn small hold" data-coach title="Press and hold">📋 Grown-ups <span>(hold)</span></button>
        </div>
      </header>

      <section class="card hero">
        <div>
          <h2>${doneToday ? 'You practiced today! 🎉' : 'Today’s routine'}</h2>
          <p class="muted">${doneToday ? 'Want to go again, or pick one below?' : 'About 10 minutes. Short, fun, and you’ll move!'}</p>
          <div class="plan">${plan.map(s => s === 'break' ? '<span class="chip">🤸 break</span>' : `<span class="chip" style="--c:${SKILL_INFO[s].color}">${SKILL_INFO[s].emoji} ${esc(SKILL_INFO[s].title)}</span>`).join('')}</div>
        </div>
        <button class="btn primary big" data-routine>${doneToday ? 'Go again' : 'Let’s go!'} ▶</button>
      </section>

      <section class="tiles">
        ${SKILLS.map(k => `
          <button class="tile-act" data-act="${k}" style="--c:${SKILL_INFO[k].color}">
            <span class="emoji">${SKILL_INFO[k].emoji}</span>
            <b>${esc(SKILL_INFO[k].title)}</b>
            <span class="small">${esc(SKILL_INFO[k].kid)}</span>
            <span class="lvl">Level ${p.levels[k]} · ${esc(LEVEL_NAME[k](p.levels[k]) || '')}</span>
          </button>`).join('')}
      </section>

      <section class="card trophies">
        <h3>Trophy case</h3>
        <div class="badges">${badges(p).map(([e, t, got]) => `<span class="badge ${got ? 'got' : ''}" title="${esc(t)}"><span>${got ? e : '🔒'}</span><small>${esc(t)}</small></span>`).join('')}</div>
      </section>
    </div>`;

  $('[data-routine]', app).onclick = routine;
  app.querySelectorAll('[data-act]').forEach(b => { b.onclick = () => freePlay(b.dataset.act); });
  $('[data-switch]', app)?.addEventListener('click', switchProfile);
  holdButton($('[data-coach]', app), () => coach(app, { onClose: home, onAddReader: () => setup({ first: false }), applySettings }));
}

function holdButton(btn, fn) {
  let timer;
  const startHold = e => {
    e.preventDefault();
    btn.classList.add('holding');
    timer = setTimeout(() => { btn.classList.remove('holding'); fn(); }, 1200);
  };
  const cancel = () => { clearTimeout(timer); btn.classList.remove('holding'); };
  btn.addEventListener('pointerdown', startHold);
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, cancel));
  btn.addEventListener('contextmenu', e => e.preventDefault());
}

function switchProfile() {
  const list = S.all().profiles;
  app.innerHTML = `
    <div class="page setup">
      <h1>Who's practicing?</h1>
      <div class="who">${list.map(p => `<button class="who-btn" data-id="${p.id}"><span class="avatar big" style="background:${p.color}">${esc(p.name[0]?.toUpperCase())}</span>${esc(p.name)}</button>`).join('')}</div>
    </div>`;
  waitClick(app, '[data-id]').then(b => { S.setActive(b.dataset.id); home(); });
}

// ---------- Running activities ----------
let current = null;

function runActivity(skill, { step, total, choose } = {}) {
  stop();
  const p = S.profile();
  const info = SKILL_INFO[skill];
  const lvl = p.levels[skill];
  app.innerHTML = `
    <div class="act-shell" style="--c:${info.color}">
      <header class="bar">
        <button class="exit" data-exit aria-label="Stop and go home">✕</button>
        <h1>${info.emoji} ${esc(info.title)}</h1>
        <span class="lvl">${step ? `Step ${step} of ${total} · ` : ''}Level ${lvl}</span>
      </header>
      <main class="act-body"></main>
    </div>`;
  const c = { dead: false, exits: [] };
  current = c;
  return new Promise(resolve => {
    const quit = () => { c.dead = true; stop(); c.exits.forEach(f => f()); resolve(null); };
    $('[data-exit]', app).onclick = quit;
    const ctx = {
      root: $('.act-body', app), level: lvl, profile: p, choose,
      alive: () => !c.dead && current === c, onExit: f => c.exits.push(f),
    };
    const t0 = Date.now();
    ACTS[skill].run(ctx).then(res => {
      if (!ctx.alive()) return;
      c.dead = true;
      resolve(res ? { ...res, ms: Date.now() - t0 } : null);
    }).catch(err => { console.error(err); c.dead = true; resolve(null); });
  });
}

function resultScreen(skill, res, rec, { routine: inRoutine, last } = {}) {
  const info = SKILL_INFO[skill];
  const p = S.profile();
  const lines = [];
  if (res.items && skill !== 'ran') {
    lines.push(res.correct ? `${res.correct} of ${res.items} on the first try` : 'You stuck with every one. That’s grit!');
  }
  if (res.metric != null && res.unit) lines.push(`${res.metric} ${res.unit}`);
  if (res.details?.personalBest) lines.push(`New personal best! (was ${res.details.old})`);
  let levelMsg = '';
  if (rec.change > 0) levelMsg = `<p class="levelup">LEVEL UP! Now: ${esc(LEVEL_NAME[skill](p.levels[skill]))}</p>`;
  if (rec.change < 0) levelMsg = '<p class="muted">We’ll practice the last level a little more. Every champion reps the basics!</p>';
  app.innerHTML = `
    <div class="page result" style="--c:${info.color}">
      <div class="big-emoji">${rec.change > 0 ? '🚀' : pick(['🎉', '📣', '⭐', '🙌'])}</div>
      <h1>${esc(pick(PRAISE))}</h1>
      <p class="lead">${esc(info.title)} done!</p>
      ${lines.map(l => `<p class="stat">${esc(l)}</p>`).join('')}
      <p class="stars">+${Math.max(1, res.correct)} ⭐</p>
      ${levelMsg}
      <div class="row">
        ${inRoutine
          ? `<button class="btn" data-home>Stop here</button><button class="btn primary big" data-next>${last ? 'Finish!' : 'Next ▶'}</button>`
          : `<button class="btn" data-home>Home</button><button class="btn primary big" data-again>Again</button>`}
      </div>
    </div>`;
  sfx(rec.change > 0 ? 'up' : 'clap');
  if (rec.change > 0 || res.details?.personalBest) confetti();
  say(`${info.title} done! ${rec.change > 0 ? 'Level up!' : ''}`);
  return waitClick(app, 'button').then(b => b.dataset.home === undefined);
}

async function freePlay(skill) {
  for (;;) {
    const res = await runActivity(skill, { choose: skill === 'fluency' });
    if (!res) return home();
    const rec = S.recordSession(skill, res);
    if (!(await resultScreen(skill, res, rec))) return home();
  }
}

async function stuntBreak() {
  const move = pick(STUNT_BREAKS);
  app.innerHTML = `
    <div class="page break">
      <p class="step">Stunt break!</p>
      <h1>${esc(move)}</h1>
      <div class="count" data-count>Ready…</div>
      <button class="btn" data-skip>Skip</button>
    </div>`;
  let skipped = false;
  const skip = waitClick(app, '[data-skip]').then(() => { skipped = true; stop(); });
  await say(`Stunt break! ${move}`);
  const el = $('[data-count]', app);
  for (let i = 1; i <= 8 && !skipped; i++) {
    if (!el.isConnected) return false;
    el.textContent = i;
    el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse');
    sfx('tap');
    await Promise.race([say(String(i), { rate: 1.1 }), skip]);
    await sleep(250);
  }
  if (!skipped) { el.textContent = '🙌'; await say('Great job! Back to work.'); }
  return true;
}

async function routine() {
  const p = S.profile();
  const plan = routinePlan(p);
  const steps = plan.filter(s => s !== 'break');
  let n = 0;
  for (let i = 0; i < plan.length; i++) {
    if (plan[i] === 'break') { if (!(await stuntBreak())) return home(); continue; }
    n++;
    const res = await runActivity(plan[i], { step: n, total: steps.length });
    if (!res) return home();
    const rec = S.recordSession(plan[i], res);
    if (!(await resultScreen(plan[i], res, rec, { routine: true, last: n === steps.length }))) return home();
  }
  finale();
}

function finale() {
  const p = S.profile();
  app.innerHTML = `
    <div class="page result">
      <div class="big-emoji">🏆</div>
      <h1>Routine complete!</h1>
      <p class="lead">You showed up and worked hard, ${esc(p.name)}. That's what champions do.</p>
      <p class="stat">🔥 ${S.streak(p)}-day streak · ⭐ ${p.stars} spirit points</p>
      <button class="btn primary big" data-home>Home</button>
    </div>`;
  confetti(80);
  sfx('up');
  say(`Routine complete! You worked hard, ${p.name}. That's what champions do!`);
  waitClick(app, '[data-home]').then(home);
}

// ---------- Start ----------
applySettings();
home();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
