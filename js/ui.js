export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const sample = (a, n) => shuffle(a).slice(0, n);

export const PRAISE = ['Nailed it!', 'Clean landing!', 'That’s how we cheer!', 'Sharp!', 'Hit it!', 'Go, go, go!', 'Spirit points!', 'Woo-hoo!'];
export const ENCOURAGE = ['Almost! Listen again.', 'Good try — rep it one more time.', 'Mistakes are just practice reps.', 'Reset and go again!', 'So close! Try another one.'];

export function toast(msg, ms = 1800) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove('show'), ms);
}

export function confetti(n = 46) {
  const colors = ['#e2366b', '#f5b400', '#2b8bd8', '#2aa36b', '#7a3ff2', '#ff7a1a'];
  const box = document.createElement('div');
  box.className = 'confetti';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    s.style.left = Math.random() * 100 + 'vw';
    s.style.background = pick(colors);
    s.style.animationDelay = Math.random() * 0.5 + 's';
    s.style.animationDuration = 1.6 + Math.random() * 1.2 + 's';
    s.style.transform = `rotate(${Math.random() * 360}deg)`;
    box.appendChild(s);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3400);
}

// Resolve with the first element matching `sel` that is clicked inside `root`.
export function waitClick(root, sel) {
  return new Promise(resolve => {
    const h = e => {
      const el = e.target.closest(sel);
      if (el && root.contains(el) && !el.disabled) { root.removeEventListener('click', h); resolve(el); }
    };
    root.addEventListener('click', h);
  });
}

export function wiggle(el) {
  el.classList.remove('wiggle');
  void el.offsetWidth;
  el.classList.add('wiggle');
}

// Small SVG line chart. points: [{x: time, y: value}]
export function lineChart(points, { w = 340, h = 120, color = '#e2366b', fmt = v => v, min, max } = {}) {
  if (!points.length) return '<p class="muted small">No practice yet.</p>';
  const ys = points.map(p => p.y);
  const lo = min ?? Math.min(...ys);
  const hi = max ?? Math.max(...ys);
  const span = hi - lo || 1;
  const pad = 22;
  const X = i => points.length === 1 ? w / 2 : pad + (i * (w - pad * 2)) / (points.length - 1);
  const Y = v => h - pad - ((v - lo) / span) * (h - pad * 2);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const dots = points.map((p, i) => `<circle cx="${X(i).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="3.5" fill="${color}"><title>${esc(new Date(p.x).toLocaleDateString())}: ${esc(fmt(p.y))}</title></circle>`).join('');
  const first = points[0].y;
  const last = points[points.length - 1].y;
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Trend from ${esc(fmt(first))} to ${esc(fmt(last))}">
    <line x1="${pad}" y1="${h - pad}" x2="${w - pad}" y2="${h - pad}" class="axis"/>
    <text x="${pad}" y="${h - 4}" class="lbl">${esc(new Date(points[0].x).toLocaleDateString())}</text>
    <text x="${w - pad}" y="${h - 4}" class="lbl" text-anchor="end">${esc(new Date(points[points.length - 1].x).toLocaleDateString())}</text>
    <text x="4" y="${Y(hi) + 4}" class="lbl">${esc(fmt(hi))}</text>
    ${hi !== lo ? `<text x="4" y="${Y(lo) + 4}" class="lbl">${esc(fmt(lo))}</text>` : ''}
    <path d="${path}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}</svg>`;
}
