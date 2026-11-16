// Math Squad — read-aloud word problems with visual steps, carrying/borrowing on a place-value chart, clocks and coins.
import { MATH_LEVELS } from './data.js';
import { say, stop, sfx } from './speech.js';
import { esc, pick, shuffle, waitClick, wiggle, sleep, PRAISE, ENCOURAGE } from './ui.js';
import { noteError } from './store.js';

const COUNT = 5;
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const NAMES = ['Mia', 'Leo', 'Ava', 'Sam', 'Zoe', 'Max', 'Lily', 'Ben'];

// A number keypad. Resolves with the number entered.
function askNumber(ctx, holder) {
  holder.innerHTML = `
    <div class="keypad">
      <div class="kp-display" data-disp>&nbsp;</div>
      <div class="kp-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="kp" data-k="${n}">${n}</button>`).join('')}
        <button class="kp" data-k="del" aria-label="Delete">⌫</button><button class="kp" data-k="0">0</button><button class="kp ok" data-k="ok" aria-label="Check">✓</button></div>
    </div>`;
  const disp = holder.querySelector('[data-disp]');
  let val = '';
  return new Promise(resolve => {
    holder.onclick = e => {
      const k = e.target.closest('[data-k]')?.dataset.k;
      if (!k || !ctx.alive()) return;
      if (k === 'del') val = val.slice(0, -1);
      else if (k === 'ok') { if (val) { holder.onclick = null; resolve(+val); } return; }
      else if (val.length < 3) val += k;
      sfx('tap');
      disp.textContent = val || ' ';
    };
  });
}

// Keep asking until right. Returns true if right the first time.
async function untilRight(ctx, holder, answer, hint) {
  for (let tries = 0; ; tries++) {
    const n = await askNumber(ctx, holder);
    if (!ctx.alive()) return null;
    if (n === answer) { sfx('ding'); return tries === 0; }
    sfx('soft');
    wiggle(holder);
    await say(tries === 0 ? `${pick(ENCOURAGE)} ${hint}` : `${hint} The answer is ${answer}. Type ${answer}.`);
    if (!ctx.alive()) return null;
  }
}

// ---------- Clock ----------
function clockSvg(h, m) {
  const ha = ((h % 12) + m / 60) * 30;
  const ma = m * 6;
  const nums = Array.from({ length: 12 }, (_, i) => {
    const a = ((i + 1) * 30 - 90) * Math.PI / 180;
    return `<text x="${100 + 72 * Math.cos(a)}" y="${100 + 72 * Math.sin(a) + 7}" text-anchor="middle">${i + 1}</text>`;
  }).join('');
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = i * 6 * Math.PI / 180;
    const r1 = i % 5 ? 88 : 84;
    return `<line x1="${100 + r1 * Math.sin(a)}" y1="${100 - r1 * Math.cos(a)}" x2="${100 + 92 * Math.sin(a)}" y2="${100 - 92 * Math.cos(a)}" />`;
  }).join('');
  return `<svg class="clock" viewBox="0 0 200 200" role="img" aria-label="Clock">
    <circle cx="100" cy="100" r="96" class="face"/><g class="ticks">${ticks}</g><g class="nums">${nums}</g>
    <line x1="100" y1="100" x2="100" y2="52" class="hour" transform="rotate(${ha} 100 100)"/>
    <line x1="100" y1="100" x2="100" y2="24" class="minute" transform="rotate(${ma} 100 100)"/>
    <circle cx="100" cy="100" r="6" class="pin"/></svg>`;
}
const fmtTime = (h, m) => `${h}:${String(m).padStart(2, '0')}`;

async function clockItem(ctx, diff) {
  const { root } = ctx;
  const h = rnd(1, 12);
  const m = diff === 1 ? pick([0, 30]) : diff === 2 ? pick([0, 15, 30, 45]) : rnd(0, 11) * 5;
  const right = fmtTime(h, m);
  const wrong = new Set();
  while (wrong.size < 2) {
    const c = pick([fmtTime(h === 12 ? 1 : h + 1, m), fmtTime(h === 1 ? 12 : h - 1, m), fmtTime(h, (m + 30) % 60), fmtTime(Math.max(1, Math.round(m / 5) || 12), h * 5 % 60)]);
    if (c !== right) wrong.add(c);
  }
  const opts = shuffle([right, ...wrong]);
  root.innerHTML = `
    <div class="stage">
      <p class="prompt">What time is it?</p>
      ${clockSvg(h, m)}
      <p class="muted small">The short hand shows the hour. The long hand shows the minutes.</p>
      <div class="options count">${opts.map(o => `<button class="option" data-c="${o}"><span class="opt-text">${o}</span></button>`).join('')}</div>
    </div>`;
  say('What time is it? The short hand shows the hour. The long hand shows the minutes.');
  for (let tries = 0; ; tries++) {
    const el = await waitClick(root, '[data-c]');
    if (!ctx.alive()) return null;
    stop();
    if (el.dataset.c === right) { el.classList.add('right'); sfx('ding'); await say(`${pick(PRAISE)} ${right}.`); return tries === 0; }
    wiggle(el); sfx('soft'); noteError('math', 'telling time');
    await say(m === 0 ? 'Look at the short hand first. It points to the hour.' : 'Short hand for the hour. Count by fives with the long hand for minutes.');
  }
}

// ---------- Word problems ----------
const TEMPLATES = {
  add: [
    (n, a, b) => `${n} has ${a} pom-poms. ${n} gets ${b} more. How many pom-poms does ${n} have now?`,
    (n, a, b) => `There are ${a} girls and ${b} boys on the team. How many kids are on the team in all?`,
    (n, a, b) => `${n} did ${a} jumps in the morning and ${b} jumps after lunch. How many jumps altogether?`,
    (n, a, b) => `The squad has ${a} red bows and ${b} blue bows. How many bows in all?`,
  ],
  sub: [
    (n, a, b) => `${n} had ${a} stickers. ${n} gave ${b} away. How many stickers are left?`,
    (n, a, b) => `There were ${a} cupcakes. The team ate ${b}. How many cupcakes are left?`,
    (n, a, b) => `The squad needs ${a} bows. They have ${b}. How many more bows do they need?`,
    (n, a, b) => `${n} read ${a} pages. A friend read ${b} pages. How many more pages did ${n} read?`,
  ],
};

async function wordItem(ctx, max) {
  const { root } = ctx;
  const op = Math.random() < 0.5 ? 'add' : 'sub';
  let a, b;
  if (op === 'add') { a = rnd(1, max - 1); b = rnd(1, max - a); } else { a = rnd(3, max); b = rnd(1, a - 1); }
  const text = pick(TEMPLATES[op])(pick(NAMES), a, b);
  const answer = op === 'add' ? a + b : a - b;
  root.innerHTML = `
    <div class="stage">
      <button class="target problem" data-say>🔊 ${esc(text).replace(/\b(\d+)\b/g, '<b class="num">$1</b>')}</button>
      <ol class="steps"><li data-s1><b>Step 1:</b> Do we add or take away?</li><li data-s2 class="later"><b>Step 2:</b> Find the answer.</li></ol>
      <div class="row" data-ops><button class="btn big" data-op="add">➕ Add</button><button class="btn big" data-op="sub">➖ Take away</button></div>
      <div class="counters" data-counters></div>
      <div data-pad></div>
    </div>`;
  root.querySelector('[data-say]').onclick = () => say(text, { rate: 0.8 });
  await say(`${text} Step 1. Do we add, or take away?`, { rate: 0.85 });
  let first = true;
  for (;;) {
    const el = await waitClick(root, '[data-op]');
    if (!ctx.alive()) return null;
    stop();
    if (el.dataset.op === op) { el.classList.add('right'); sfx('ding'); break; }
    first = false; wiggle(el); sfx('soft'); noteError('math', 'choosing add or subtract');
    await say(op === 'add'
      ? 'Clue words like more, in all, and altogether mean we put the groups together. That’s adding.'
      : 'Clue words like left, gave away, ate, and how many more mean we take away or compare. That’s subtracting.');
  }
  root.querySelector('[data-s2]').classList.remove('later');
  if (max <= 20) {
    const dots = op === 'add'
      ? `${'<i class="dot-a"></i>'.repeat(a)}<span class="plus">+</span>${'<i class="dot-b"></i>'.repeat(b)}`
      : `${'<i class="dot-a"></i>'.repeat(a - b)}${'<i class="dot-a gone"></i>'.repeat(b)}`;
    root.querySelector('[data-counters]').innerHTML = dots;
  }
  await say(`Step 2. ${op === 'add' ? `${a} plus ${b}` : `${a} take away ${b}`}. Type the answer.`);
  const ok = await untilRight(ctx, root.querySelector('[data-pad]'), answer, op === 'add' ? `Count on from ${a}.` : `Count back from ${a}, or count up from ${b}.`);
  if (ok === null) return null;
  if (ok) await say(pick(PRAISE));
  return first && ok;
}

// ---------- Carrying and borrowing ----------
function chart(rows) {
  return `<table class="pv"><thead><tr><th>Tens</th><th>Ones</th></tr></thead><tbody>${rows.map(r => `<tr class="${r.cls || ''}"><td data-t>${r.t ?? ''}</td><td data-o>${r.o ?? ''}</td></tr>`).join('')}</tbody></table>`;
}

async function carryItem(ctx) {
  const { root } = ctx;
  let a, b;
  do { a = rnd(15, 79); b = rnd(11, 89 - a + 10); } while ((a % 10) + (b % 10) < 10 || a + b > 99);
  const [at, ao, bt, bo] = [Math.floor(a / 10), a % 10, Math.floor(b / 10), b % 10];
  const s1 = ao + bo;
  root.innerHTML = `
    <div class="stage">
      <p class="prompt">${a} + ${b}</p>
      <div data-chart>${chart([{ cls: 'carry', t: '', o: '' }, { t: at, o: ao }, { t: '+' + bt, o: bo, cls: 'line' }, { cls: 'ans', t: '', o: '' }])}</div>
      <p class="hint" data-hint>Start with the <b>ones</b>: ${ao} + ${bo} = ?</p>
      <div data-pad></div>
    </div>`;
  const hint = root.querySelector('[data-hint]');
  const cells = root.querySelectorAll('.pv tbody tr');
  cells[1].querySelector('[data-o]').classList.add('focus'); cells[2].querySelector('[data-o]').classList.add('focus');
  await say(`${a} plus ${b}. Always start with the ones. ${ao} plus ${bo}?`);
  const ok1 = await untilRight(ctx, root.querySelector('[data-pad]'), s1, `Count on from ${ao}.`);
  if (ok1 === null) return null;
  cells[3].querySelector('[data-o]').textContent = s1 - 10;
  cells[0].querySelector('[data-t]').textContent = '1';
  hint.innerHTML = `${s1} ones = <b>1 ten</b> and <b>${s1 - 10} ones</b>. Write ${s1 - 10}, carry the 1 to the tens. Now the <b>tens</b>: 1 + ${at} + ${bt} = ?`;
  root.querySelectorAll('.focus').forEach(c => c.classList.remove('focus'));
  [0, 1, 2].forEach(i => cells[i].querySelector('[data-t]').classList.add('focus'));
  sfx('up');
  await say(`${s1} ones is 1 ten and ${s1 - 10} ones. Write ${s1 - 10}, and carry the 1 to the tens. Now the tens. 1 plus ${at} plus ${bt}?`);
  const ok2 = await untilRight(ctx, root.querySelector('[data-pad]'), 1 + at + bt, 'Don’t forget the carried 1!');
  if (ok2 === null) return null;
  cells[3].querySelector('[data-t]').textContent = 1 + at + bt;
  root.querySelector('[data-pad]').innerHTML = '';
  hint.innerHTML = `<b>${a} + ${b} = ${a + b}</b>`;
  await say(`${pick(PRAISE)} ${a} plus ${b} is ${a + b}.`);
  return ok1 && ok2;
}

async function borrowItem(ctx) {
  const { root } = ctx;
  let a, b;
  do { a = rnd(31, 98); b = rnd(11, a - 10); } while ((a % 10) >= (b % 10));
  const [at, ao, bt, bo] = [Math.floor(a / 10), a % 10, Math.floor(b / 10), b % 10];
  root.innerHTML = `
    <div class="stage">
      <p class="prompt">${a} − ${b}</p>
      <div data-chart>${chart([{ cls: 'carry', t: '', o: '' }, { t: at, o: ao }, { t: '−' + bt, o: bo, cls: 'line' }, { cls: 'ans', t: '', o: '' }])}</div>
      <p class="hint" data-hint>Start with the <b>ones</b>. Can we take ${bo} from ${ao}?</p>
      <div class="row" data-yn><button class="btn big" data-yes>Yes</button><button class="btn big" data-no>No — borrow a ten</button></div>
      <div data-pad></div>
    </div>`;
  const hint = root.querySelector('[data-hint]');
  const cells = root.querySelectorAll('.pv tbody tr');
  await say(`${a} minus ${b}. Start with the ones. Can we take ${bo} away from ${ao}?`);
  let first = true;
  for (;;) {
    const el = await waitClick(root, '[data-yes], [data-no]');
    if (!ctx.alive()) return null;
    if (el.dataset.no !== undefined) break;
    first = false; wiggle(el); sfx('soft'); noteError('math', 'borrowing');
    await say(`${ao} is smaller than ${bo}, so we can’t. We need to borrow a ten.`);
  }
  root.querySelector('[data-yn]').remove();
  cells[1].querySelector('[data-t]').innerHTML = `<s>${at}</s>`;
  cells[0].querySelector('[data-t]').textContent = at - 1;
  cells[1].querySelector('[data-o]').innerHTML = `<s>${ao}</s>`;
  cells[0].querySelector('[data-o]').textContent = ao + 10;
  hint.innerHTML = `Borrow 1 ten: ${at} tens becomes <b>${at - 1}</b>, and ${ao} ones becomes <b>${ao + 10}</b>. Now: ${ao + 10} − ${bo} = ?`;
  sfx('up');
  await say(`Borrow one ten. ${at} tens becomes ${at - 1}. ${ao} ones becomes ${ao + 10}. Now, ${ao + 10} minus ${bo}?`);
  const ok1 = await untilRight(ctx, root.querySelector('[data-pad]'), ao + 10 - bo, `Count up from ${bo} to ${ao + 10}.`);
  if (ok1 === null) return null;
  cells[3].querySelector('[data-o]').textContent = ao + 10 - bo;
  hint.innerHTML = `Now the <b>tens</b>: ${at - 1} − ${bt} = ?`;
  await say(`Now the tens. ${at - 1} minus ${bt}?`);
  const ok2 = await untilRight(ctx, root.querySelector('[data-pad]'), at - 1 - bt, `Remember, the tens went down to ${at - 1}.`);
  if (ok2 === null) return null;
  cells[3].querySelector('[data-t]').textContent = at - 1 - bt || '';
  root.querySelector('[data-pad]').innerHTML = '';
  hint.innerHTML = `<b>${a} − ${b} = ${a - b}</b>`;
  await say(`${pick(PRAISE)} ${a} minus ${b} is ${a - b}.`);
  return first && ok1 && ok2;
}

// ---------- Coins ----------
async function coinItem(ctx) {
  const { root } = ctx;
  const kinds = [[25, 'quarter'], [10, 'dime'], [5, 'nickel'], [1, 'penny']];
  let coins;
  do { coins = Array.from({ length: rnd(3, 6) }, () => pick(kinds)); } while (coins.reduce((s, c) => s + c[0], 0) > 99);
  coins.sort((x, y) => y[0] - x[0]);
  const total = coins.reduce((s, c) => s + c[0], 0);
  root.innerHTML = `
    <div class="stage">
      <p class="prompt">How much money? (in cents)</p>
      <div class="coins">${coins.map(([v, n]) => `<span class="coin c${v}" title="${n}">${v}¢<small>${n}</small></span>`).join('')}</div>
      <p class="muted small">Start with the biggest coins and count on.</p>
      <div data-pad></div>
    </div>`;
  await say('How much money? Start with the biggest coins, and count on.');
  let run = 0;
  const steps = coins.map(([v]) => (run += v));
  const ok = await untilRight(ctx, root.querySelector('[data-pad]'), total, `Count on: ${steps.join(', ')}.`);
  if (ok === null) return null;
  await say(`${pick(PRAISE)} ${total} cents.`);
  return ok;
}

export async function run(ctx) {
  const types = MATH_LEVELS[ctx.level - 1].types;
  let correct = 0;
  for (let q = 0; q < COUNT; q++) {
    const type = types[q % types.length];
    ctx.root.innerHTML = '';
    const ok = await ({
      clock1: () => clockItem(ctx, 1), clock2: () => clockItem(ctx, 2), clock3: () => clockItem(ctx, 3),
      word10: () => wordItem(ctx, 10), word20: () => wordItem(ctx, 20), word100: () => wordItem(ctx, 99),
      carry: () => carryItem(ctx), borrow: () => borrowItem(ctx), coins: () => coinItem(ctx),
    })[type]();
    if (ok === null || !ctx.alive()) return null;
    if (ok) correct++;
    await sleep(700);
  }
  return { items: COUNT, correct };
}
