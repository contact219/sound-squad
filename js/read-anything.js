// Read Anything — take a photo of a page (or paste text) and have it read aloud, phrase by phrase.
// The words are found on this device (Tesseract.js); the photo is never uploaded.
import { chunkPhrases } from './data.js';
import { waitClick, toast } from './ui.js';
import { save } from './store.js';

const TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
let loading;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = TESSERACT;
      s.onload = () => resolve(window.Tesseract);
      s.onerror = () => { loading = null; reject(new Error('Could not load the word reader. Check the internet connection.')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

// Returns a story object to read, or null if the reader backs out.
export async function getPage(ctx) {
  const { root, profile } = ctx;
  root.innerHTML = `
    <div class="stage">
      <p class="prompt">Read anything!</p>
      <p class="muted">Take a photo of a worksheet, book page or sign, and I'll read it to you.</p>
      <div class="row">
        <label class="btn primary big">📷 Take a photo<input type="file" accept="image/*" capture="environment" data-photo hidden></label>
        <button class="btn big" data-paste>📋 Type or paste words</button>
      </div>
      <img class="scan-preview" data-preview alt="" hidden>
      <p class="status" data-status></p>
      <div class="scan-edit" data-edit hidden>
        <label class="small">Grown-up: fix any words the reader got wrong.
          <textarea data-text rows="7"></textarea></label>
        <label class="check small"><input type="checkbox" data-keep> Save it to our stories</label>
        <button class="btn primary big" data-read>📖 Read it to me</button>
      </div>
      <p class="muted small">The photo stays on this device. The first time, the word reader (about 5 MB) downloads from the internet.</p>
    </div>`;
  const status = root.querySelector('[data-status]');
  const edit = root.querySelector('[data-edit]');
  const ta = root.querySelector('[data-text]');
  const preview = root.querySelector('[data-preview]');

  root.querySelector('[data-paste]').onclick = () => { edit.hidden = false; ta.focus(); };
  root.querySelector('[data-photo]').onchange = async e => {
    const file = e.target.files[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.hidden = false;
    status.textContent = 'Getting the word reader ready…';
    try {
      const T = await loadTesseract();
      const worker = await T.createWorker('eng', 1, {
        logger: m => { if (m.status === 'recognizing text') status.textContent = `Reading the words… ${Math.round(m.progress * 100)}%`; },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const text = data.text.replace(/-\n/g, '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
      ta.value = text;
      edit.hidden = false;
      status.textContent = text ? 'Done! Check the words below.' : 'I couldn’t find any words. Try a closer, brighter photo.';
    } catch (err) {
      status.textContent = err.message || 'Something went wrong reading the photo.';
    }
  };

  for (;;) {
    await waitClick(root, '[data-read]');
    if (!ctx.alive()) return null;
    const text = ta.value.trim();
    if (text.split(/\s+/).length < 2) { toast('Add some words first.'); continue; }
    const story = { id: 'scan-' + Date.now().toString(36), title: text.split(/\s+/).slice(0, 4).join(' ') + '…', text: chunkPhrases(text), questions: [], level: 0 };
    if (root.querySelector('[data-keep]').checked) {
      profile.stories.push(story);
      save();
    }
    if (preview.src) URL.revokeObjectURL(preview.src);
    return story;
  }
}
