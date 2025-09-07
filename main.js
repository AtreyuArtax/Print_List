'use strict';

/* =========================
   Config
========================= */
const ICON_BASE = 'assets';   // folder that holds your 66x66 (or 96x96) PNGs
const ICON_EXT  = 'png';      // png/webp/jpg etc.

/* =========================
   Icon map (JSON)
========================= */
let ICON_KEYS = new Set(); // canonical keys ("banana","tomato",...)
let SYNONYMS  = {};        // "ripe banana" -> "banana, "bell pepper" -> "pepper", etc.

// The old function is replaced by the new one below
// async function loadIconMap() {
//   const res = await fetch('./icon-map.json?v=' + Date.now(), { cache: 'no-store' });
//   if (!res.ok) throw new Error(`icon-map.json fetch failed: ${res.status} ${res.statusText}`);
//   const data = await res.json();
//   ICON_KEYS = new Set(data.canonical || []);
///  SYNONYMS  = data.synonyms  || {};
//   console.log('[icon-map] loaded:', ICON_KEYS.size, 'keys,', Object.keys(SYNONYMS).length, 'synonyms');
// }

/* =========================
   Icon Matching (Drop-in)
   - No canonical whitelist required
   - Optional synonyms via icon-map.json
   - Handles case, plurals, and common modifiers
========================= */

// If you already define these, keep your originals and remove these lines.
// const ICON_BASE = 'assets';    // folder that holds your PNGs
// const ICON_EXT  = 'png';       // png/webp/jpg etc.

// let SYNONYMS = {};           // e.g., { "pb": "peanut_butter", "bell pepper": "pepper" }

/**
 * Load synonyms from icon-map.json if present.
 * - canonical list is IGNORED by design (no whitelist).
 * - Missing file or bad JSON -> gracefully falls back to {}.
 */
async function loadIconMap() {
  try {
    const res = await fetch('./icon-map.json?v=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`icon-map.json fetch failed: ${res.status} ${res.statusText}`);
    const data = await res.json();
    SYNONYMS = data?.synonyms || {};
    console.log('[icon-map] synonyms loaded:', Object.keys(SYNONYMS).length);
  } catch (err) {
    console.warn('[icon-map] no synonyms loaded (optional):', err?.message || err);
    SYNONYMS = {};
  }
}

/* =========================
   Normalization helpers
========================= */

function normalize(s) {
  return (s || '')
    // 1) Remove bracketed annotations entirely (non-greedy, supports multiples)
    //    e.g., "peppers (check date) (sale)" -> "peppers  "
    .replace(/\([^()]*\)/g, '')         // remove (...) blocks (non-nested)
    // If you also want to drop square/curly-brace notes, uncomment these:
    // .replace(/\[[^[\]]*\]/g, '')     // remove [...] blocks
    // .replace(/\{[^{}]*\}/g, '')      // remove {...} blocks

    // 2) Lowercase and strip accents
    .toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')

    // 3) Strip possessives before generic punctuation handling
    //    NEW: prevents "kids’ yogurt" → "kid yogurt" side-effects in plural logic
    .replace(/['’]s\b/g, '')            // remove ’s / 's
    .replace(/\b['’]\b/g, '')           // dangling apostrophes between words

    // 4) Unify separators and drop punctuation
    .replace(/[_/\\]/g, ' ')            // underscores/slashes → space
    .replace(/[^\w\s-]/g, ' ')          // drop other punctuation

    // 5) Collapse whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

// Words we ignore before matching (colors, packaging, generic descriptors)
const COMMON_MODS = new Set([
  'green','red','yellow','orange','ripe','unripe','fresh','frozen','organic',
  'large','small','medium','big','mini',
  'bag','box','bottle','jar','pack','pkg','tin','can','carton','case',
  'check','note','sale','bulk','family','value','bundle'
]);

function stripModifiers(text) {
  const words = text.split(' ').filter(Boolean);
  const kept = words.filter(w => !COMMON_MODS.has(w));
  return kept.join(' ') || text; // keep original if we stripped everything
}

// Basic plural → singular handling for grocery words (unchanged)
// Protects -us endings (e.g., hummus) from being truncated.
function singularizeWord(w) {
  if (/ies$/.test(w)) return w.replace(/ies$/, 'y');               // berries -> berry
  if (/(ches|shes|xes|zes)$/.test(w)) return w.replace(/es$/, ''); // boxes -> box, dishes -> dish
  if (/oes$/.test(w)) return w.replace(/es$/, 'o');                 // tomatoes -> tomato
  if (/s$/.test(w) && !/(ss|us)$/.test(w)) return w.replace(/s$/, ''); // apples -> apple
  return w;
}

function toKey(s) {
  // Convert spaces to underscore for filenames like peanut_butter.png
  return s.replace(/\s+/g, '_');
}

/* =========================
   Core matching (no whitelist)
========================= */

/**
 * Returns an icon key (string) or null.
 * Strategy:
 * 1) Clean + strip modifiers.
 * 2) Try synonyms on full phrase.
 * 3) Try direct filename from full phrase.
 * 4) Try tail n-grams (3 → 2 → 1 words), with synonyms first, then direct.
 * 5) Try last token, then any token (singularized).
 * 6) Null if nothing sensible.
 *
 * NOTE: We DO NOT check if the file exists. <img>.onerror will handle misses.
 */
function pickIconKeySmart(rawText) {
  const cleaned = normalize(stripModifiers(normalize(rawText)));
  if (!cleaned) return null;

  // Full phrase → singularize tokens
  const words = cleaned.split(' ').filter(Boolean);
  const singularWords = words.map(singularizeWord);
  const fullSingular = singularWords.join(' ');

  // 1) Full phrase via synonyms
  if (SYNONYMS[cleaned]) return toKey(SYNONYMS[cleaned]);
  if (SYNONYMS[fullSingular]) return toKey(SYNONYMS[fullSingular]);

  // 2) Full phrase direct
  if (fullSingular) return toKey(fullSingular);

  // 3) Tail n-grams (3 → 2 → 1)
  for (let n = Math.min(3, singularWords.length); n >= 1; n--) {
    const tail = singularWords.slice(-n).join(' ');
    if (SYNONYMS[tail]) return toKey(SYNONYMS[tail]);
    if (tail) return toKey(tail);
  }

  // 4) Last token, then any token
  if (singularWords.length) {
    const last = singularWords[singularWords.length - 1];
    if (SYNONYMS[last]) return toKey(SYNONYMS[last]);
    if (last) return toKey(last);
  }
  for (const w of singularWords) {
    if (SYNONYMS[w]) return toKey(SYNONYMS[w]);
    if (w) return toKey(w);
  }

  return null;
}

/* =========================
   Utilities for consumers
========================= */

function getIconUrlForText(rawText, base = ICON_BASE, ext = ICON_EXT) {
  const key = pickIconKeySmart(rawText);
  return key ? `${base}/${key}.${ext}` : null;
}

/**
 * Create a <span class="icon"> with <img>, auto-removing on 404.
 * Returns the span element or null if no key.
 */
function createIconEl(rawText, base = ICON_BASE, ext = ICON_EXT) {
  const url = getIconUrlForText(rawText, base, ext);
  if (!url) return null;

  const span = document.createElement('span');
  span.className = 'icon-wrap';
  const img = document.createElement('img');
  img.decoding = 'async';
  img.loading = 'lazy';
  img.alt = '';
  img.src = url;

  // If file doesn't exist, just remove the wrapper quietly
  img.onerror = () => span.remove();

  span.appendChild(img);
  return span;
}

/* =========================
   Parsing Markdown-ish input
========================= */
const re = {
  atx:            /^\s*(#{1,6})\s+(.*)\s*$/,
  mdUnchecked:    /^\s*[-*+]\s*\[\s\]\s+(.*)$/,
  mdChecked:      /^\s*[-*+]\s*\[[xX]\]\s+(.*)$/,
  yourChecked:    /^\s*✓\s+(.*)$/,
  yourUnchecked:  /^\s*◦\s+(.*)$/,
  fallbackBullet: /^\s*[-*+]\s+(.*)$/
};

function parseMarkdownList(src){
  const lines = src.split(/\r?\n/);
  let title=null; const sections=[]; let currentSection=null;
  function ensureSection(name){ currentSection={name:name.trim(),items:[]}; sections.push(currentSection); }
  for(const raw of lines){
    const line = raw.replace(/\s+$/,'');
    if(!line.trim()) continue;

    const mAtx = line.match(re.atx);
    if(mAtx){
      const level=mAtx[1].length; const text=mAtx[2].trim();
      if(level===1 && !title){ title=text; } else { ensureSection(text); }
      continue;
    }

    let isItem=false, checked=false, text="", m;
    if((m=line.match(re.mdChecked)))          { isItem=true; checked=true;  text=m[1]; }
    else if((m=line.match(re.mdUnchecked)))   { isItem=true; checked=false; text=m[1]; }
    else if((m=line.match(re.yourChecked)))   { isItem=true; checked=true;  text=m[1]; }
    else if((m=line.match(re.yourUnchecked))) { isItem=true; checked=false; text=m[1]; }
    else if((m=line.match(re.fallbackBullet))){ isItem=true; checked=false; text=m[1]; }

    if(isItem){
      if(!currentSection) ensureSection('Items');
      if(!checked) currentSection.items.push(text.trim());
      continue;
    }

    if(!title){ title=line.trim(); } else { ensureSection(line.trim()); }
  }
  return { title: title||'List', sections: sections.filter(s=>s.items.length>0) };
}

/* =========================
   Quadrant flow (screen)
========================= */
// Replaces the previous version with one that uses print-true geometry
// to pack against the *print* geometry (Letter page + CSS vars),
// so the on-screen packing matches what will print.
// This version uses a row-major flow (TL -> TR -> BL -> BR).

async function flowIntoQuadrants(sections){
  await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)));

  // ---- Print-true geometry ----
  const mmToPx = (mm)=> mm * (96/25.4);
  const css = getComputedStyle(document.documentElement);

  const mTop    = parseFloat(css.getPropertyValue('--print-margin-top'))    || 0;
  const mRight  = parseFloat(css.getPropertyValue('--print-margin-right'))  || 0;
  const mBottom = parseFloat(css.getPropertyValue('--print-margin-bottom')) || 0;
  const mLeft   = parseFloat(css.getPropertyValue('--print-margin-left'))   || 0;
  const gutter  = parseFloat(css.getPropertyValue('--fold-gutter'))         || 0;
  const title   = parseFloat(css.getPropertyValue('--title-block'))         || 0;

  // convert --section-gap (likely rem) to px
  const gapVar = (css.getPropertyValue('--section-gap') || '').trim();
  const rootFontPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  let sectionGapPx = 0;
  if (gapVar.endsWith('rem')) sectionGapPx = parseFloat(gapVar) * rootFontPx;
  else if (gapVar.endsWith('px')) sectionGapPx = parseFloat(gapVar);
  else if (gapVar) sectionGapPx = parseFloat(gapVar) || 0; // fallback

  const pageW = 816, pageH = 1056; // Letter @ 96dpi
  const contentW = pageW - mmToPx(mLeft) - mmToPx(mRight);
  const contentH = pageH - mmToPx(mTop)  - mmToPx(mBottom);

  const colGap = mmToPx(gutter);
  const rowGap = mmToPx(gutter);

  // A more robust width calculation that guarantees content fits
  const quadW = (contentW - colGap) / 2 - 1.5;

  // Calculate the raw height of a quadrant
  const quadRawH = Math.floor((contentH - rowGap) / 2 - 1.5);

  // The available height for the content in each quadrant,
  // with a slight reduction for the TR and TL quadrants to prevent overflow.
  const TL_HEIGHT_REDUCTION = 4;
  const TR_HEIGHT_REDUCTION = 14; // User's suggested fix for better overflow prevention
  const quadHeights = [
    quadRawH - TL_HEIGHT_REDUCTION,
    quadRawH - TR_HEIGHT_REDUCTION,
    quadRawH,
    quadRawH
  ];

  // ---- Offscreen measurer matching list styles ----
  const out = document.getElementById('out') || document.body;
  const measurer = document.createElement('div');
  measurer.style.visibility = 'hidden';
  measurer.style.position = 'absolute';
  measurer.style.left = '-99999px';
  out.appendChild(measurer);

  const measureSection = (name, items) => {
    measurer.innerHTML = '';
    const sec = document.createElement('section'); sec.className = 'section';
    const h2  = document.createElement('h2'); h2.textContent = name; sec.appendChild(h2);
    const ul  = document.createElement('ul'); ul.className = 'items';
    for(const txt of items){
      const li = document.createElement('li'); li.className = 'item';
      const cb = document.createElement('span'); cb.className = 'cb'; cb.setAttribute('aria-hidden','true');
      const label = document.createElement('span'); label.className = 'item-label'; label.textContent = txt;
      li.appendChild(cb); li.appendChild(label); ul.appendChild(li);
    }
    sec.appendChild(ul);
    measurer.appendChild(sec);
    sec.style.width = quadW + 'px';          // wrap like a real column
    return sec.offsetHeight;                   // NOTE: margins are NOT included
  };

  // ---- Height-aware packing (row-major) with section-gap accounted ----
  const result = [[],[],[],[]];

  let step = 0;
  const order = [0,1,2,3]; // TL, TR, BL, BR
  let q = order[step];
  let usedH = 0;
  let countInQuadrant = 0;

  const advance = () => {
    step = Math.min(step + 1, 3);
    q = order[step];
    usedH = 0;
    countInQuadrant = 0;
  };

  const epsilon = 1; // safety margin

  for (const section of sections){
    const tryPlaceWhole = () => {
      const h = measureSection(section.name, section.items);
      const gap = countInQuadrant > 0 ? sectionGapPx : 0;
      let availableH = quadHeights[q] - usedH - epsilon;
      // Subtract title height ONLY for the first section in the first quadrant
      if (q === 0 && countInQuadrant === 0) availableH -= mmToPx(title);
      return (h + gap) <= availableH ? { ok:true, h:h+gap } : { ok:false, h };
    };

    // Attempt to place whole section
    let attempt = tryPlaceWhole();
    if (attempt.ok){
      if (countInQuadrant > 0) usedH += sectionGapPx;
      result[q].push({ name: section.name, items: section.items.slice() });
      usedH += (attempt.h - (countInQuadrant > 0 ? sectionGapPx : 0)); // add pure section height after adding gap
      countInQuadrant++;
      continue;
    }

    // Split across quadrants
    let start = 0, part = 1;
    while (start < section.items.length && step < 4){
      let currH = quadHeights[q];
      // Subtract title height ONLY for the first section in the first quadrant
      if (q === 0 && countInQuadrant === 0) currH -= mmToPx(title);

      // Binary search: largest slice that fits, considering the gap if needed
      let lo = 1, hi = section.items.length - start, bestN = 0, bestTotalH = 0, bestPureH = 0;
      while (lo <= hi){
        const mid = (lo + hi) >> 1;
        const slice = section.items.slice(start, start + mid);
        const name = (start === 0 && part === 1) ? section.name : `${section.name} (cont.)`;
        const pureH = measureSection(name, slice);
        const totalH = pureH + (countInQuadrant > 0 ? sectionGapPx : 0);
        if (totalH <= (currH - usedH - epsilon)){
          bestN = mid; bestTotalH = totalH; bestPureH = pureH; lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      if (bestN > 0){
        const name = (start === 0 && part === 1) ? section.name : `${section.name} (cont.)`;
        if (countInQuadrant > 0) { usedH += sectionGapPx; }
        result[q].push({ name, items: section.items.slice(start, start + bestN) });
        usedH += bestPureH;
        start += bestN;
        part++;
        countInQuadrant++;

        if (start < section.items.length){
          if (step >= 3) break;
          advance();
        }
      } else {
        // Nothing fits here; advance quadrant
        if (step >= 3) break;
        advance();
      }
    }

    if (step >= 3 && usedH >= quadHeights[q]) break;
  }

  out.removeChild(measurer);
  return result;
}

/* =========================
   Render (screen)
========================= */
async function renderQuadrants(model){
  const out = document.getElementById('out'); out.innerHTML = '';

  const title = document.createElement('div');
  title.className='list-title';
  title.textContent = model.title;
  out.appendChild(title);

  if(model.sections.length===0){
    const p=document.createElement('div');
    p.className='empty-note';
    p.textContent='All items are checked. Nothing left to buy 🎉';
    out.appendChild(p);
    return;
  }

  const grid = document.createElement('div'); grid.className='grid4'; out.appendChild(grid);
  const quads = await flowIntoQuadrants(model.sections);

  for(let q=0;q<4;q++){
    const box = document.createElement('div'); box.className='quad'; grid.appendChild(box);
    for(const section of quads[q]){
      const sec = document.createElement('section'); sec.className='section';
      const h = document.createElement('h2'); h.textContent = section.name; sec.appendChild(h);
      const ul = document.createElement('ul'); ul.className='items';
      for(const rawItem of section.items){
        const item = rawItem.trim();
        const li=document.createElement('li'); li.className='item';
        const cb=document.createElement('span'); cb.className='cb'; cb.setAttribute('aria-hidden','true');

        const label=document.createElement('span'); label.className='item-label';
        label.textContent=item;

        const iconEl = createIconEl(item);
        if (iconEl) {
          label.appendChild(iconEl);
        }

        li.appendChild(cb);
        li.appendChild(label);
        ul.appendChild(li);
      }
      sec.appendChild(ul); box.appendChild(sec);
    }
  }
}

function filterNow(){
  const src = document.getElementById('src').value || '';
  const model = parseMarkdownList(src);
  renderQuadrants(model);
}

/* =========================
   PDF (simple snapshot of #out)
   — your CSS already handles the print grid & gutters
========================= */
function mmToPx(mm){ return mm * (96/25.4); }

function enterPdfMode(outEl){
  const root = getComputedStyle(document.documentElement);
  const mTop    = parseFloat(root.getPropertyValue('--print-margin-top'))    || 0;
  const mRight  = parseFloat(root.getPropertyValue('--print-margin-right'))  || 0;
  const mBottom = parseFloat(root.getPropertyValue('--print-margin-bottom')) || 0;
  const mLeft   = parseFloat(root.getPropertyValue('--print-margin-left'))   || 0;
  const gutter  = parseFloat(root.getPropertyValue('--fold-gutter'))         || 0;
  const title   = parseFloat(root.getPropertyValue('--title-block'))         || 0;

  const pageW = 816;  // 8.5in * 96dpi
  const pageH = 1056; // 11in  * 96dpi

  const contentW = pageW - mmToPx(mLeft) - mmToPx(mRight);
  const contentH = pageH - mmToPx(mTop)  - mmToPx(mBottom);

  const grid = outEl.querySelector('.grid4');
  outEl.style.width  = pageW + 'px';
  outEl.style.height = pageH + 'px';
  outEl.style.boxSizing = 'content-box';
  outEl.style.padding = `${mmToPx(mTop)}px ${mmToPx(mRight)}px ${mmToPx(mBottom)}px ${mmToPx(mLeft)}px`;

  // Apply print-like grid metrics
  grid.style.display = 'grid';
  grid.style.columnGap = mmToPx(gutter) + 'px';
  grid.style.rowGap    = mmToPx(gutter) + 'px';
  grid.style.gridTemplateColumns =
    `calc(50% - ${mmToPx(gutter)/2}px) calc(50% - ${mmToPx(gutter)/2}px)`;
  const rowsH = (contentH - mmToPx(gutter) - mmToPx(title)) / 2;
  grid.style.gridTemplateRows = `${rowsH}px ${rowsH}px`;

  return () => {
    // revert
    outEl.style.width = outEl.style.height = outEl.style.padding = outEl.style.boxSizing = '';
    grid.style.columnGap = grid.style.rowGap = grid.style.gridTemplateColumns = grid.style.gridTemplateRows = '';
  };
}

async function generatePDF(){
  const outEl = document.getElementById('out');
  if (!outEl) return;

  // Ensure fonts & images are ready (crisper canvas)
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch {}
  }
  const imgs = Array.from(outEl.querySelectorAll('img'));
  await Promise.all(imgs.map(img => {
    img.loading = 'eager';
    return (img.decode ? img.decode() : Promise.resolve()).catch(()=>{});
  }));

  // Let layout fully settle
  await new Promise(r => requestAnimationFrame(()=>requestAnimationFrame(r)));

  // Temporarily apply print geometry for the snapshot
  const exit = enterPdfMode(outEl);

  // Choose a crisp-but-safe scale (avoid iOS memory blowups)
  const isiOS = /\b(iPad|iPhone|iPod)\b/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const pageCSSw = 816, pageCSSh = 1056;   // Letter @ 96dpi in CSS px
  const maxPixels = isiOS ? 16e6 : 48e6;   // rough caps
  let scale = isiOS ? 2 : 4;               // target crispness

  while ((pageCSSw * pageCSSh * scale * scale) > maxPixels && scale > 1.5) {
    scale -= 0.5;
  }

  const canvas = await html2canvas(outEl, {
    backgroundColor: '#ffffff',
    useCORS: true,
    allowTaint: false,
    imageTimeout: 0,
    scale
  });

  // Revert temporary styles
  exit();

  // Optional: helps tiny icons when downscaling
  const ctx = canvas.getContext('2d');
  if (ctx) ctx.imageSmoothingEnabled = false;

  // Match PDF page to canvas size to avoid any resampling
  const pxToPt = 0.75; // 72/96
  const pdfWpt = canvas.width * pxToPt;
  const pdfHpt = canvas.height * pxToPt;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'pt', format: [pdfWpt, pdfHpt] });

  // Use PNG for sharper text/edges
  const dataUrl = canvas.toDataURL('image/png');
  doc.addImage(dataUrl, 'PNG', 0, 0, pdfWpt, pdfHpt, undefined, 'FAST');

  if (isiOS) {
    const blob = doc.output('blob');
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    if ('download' in HTMLAnchorElement.prototype) a.download = 'grocery_list.pdf';
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 5000);
  } else {
    doc.output('dataurlnewwindow'); // or doc.save('grocery_list.pdf');
  }
}

/* =========================
   Text size control
========================= */
const sizeMap = {
  small:  { title:'1.35rem', heading:'0.95rem', item:'0.9rem'  },
  normal: { title:'1.55rem', heading:'1.05rem', item:'1rem'    },
  large:  { title:'1.75rem', heading:'1.15rem', item:'1.15rem' },
  xlarge: { title:'1.95rem', heading:'1.25rem', item:'1.30rem' }
};

function applyTextSize(key){
  const v = sizeMap[key] || sizeMap.normal;
  const r = document.documentElement.style;
  r.setProperty('--title-size',   v.title);
  r.setProperty('--heading-size', v.heading);
  r.setProperty('--item-size',    v.item);
  filterNow();
}

/* =========================
   Init & events
========================= */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadIconMap();
  } catch (e) {
    console.error(e);
    // Use an error box instead of an alert
    const errorBox = document.createElement('div');
    errorBox.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; color: #721c24; z-index: 1000;';
    errorBox.textContent = 'Could not load icon-map.json. Icons may be missing.';
    document.body.appendChild(errorBox);
    setTimeout(() => errorBox.remove(), 5000);
  }

  const sel = document.getElementById('opt-size');
  const saved = localStorage.getItem('optSize');
  if(saved && sizeMap[saved]) sel.value = saved;
  applyTextSize(sel.value);
  sel.addEventListener('change', ()=>{
    localStorage.setItem('optSize', sel.value);
    applyTextSize(sel.value);
  });

  document.getElementById('btn-sample')?.addEventListener('click', async ()=>{
    try{
      const res = await fetch('sample.md?v=' + Date.now(), { cache: 'no-store' });
      const text = await res.text();
      document.getElementById('src').value = text;
      filterNow();
    }catch(e){
      // Use an error box instead of an alert
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; color: #721c24; z-index: 1000;';
      errorBox.textContent = 'Could not load sample.md';
      document.body.appendChild(errorBox);
      setTimeout(() => errorBox.remove(), 5000);
    }
  });

  document.getElementById('btn-pdf')?.addEventListener('click', async ()=>{
    const btn = document.getElementById('btn-pdf');
    btn.disabled = true; const prev = btn.textContent; btn.textContent = 'Building…';
    try { await generatePDF(); }
    catch(e){
      console.error(e);
      // Use an error box instead of an alert
      const errorBox = document.createElement('div');
      errorBox.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); padding: 20px; background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 5px; color: #721c24; z-index: 1000;';
      errorBox.textContent = 'PDF failed — see console.';
      document.body.appendChild(errorBox);
      setTimeout(() => errorBox.remove(), 5000);
    }
    finally { btn.disabled = false; btn.textContent = prev; }
  });

  // Auto render (debounced)
  let _tid;
  document.getElementById('src')?.addEventListener('input', ()=>{
    clearTimeout(_tid);
    _tid = setTimeout(filterNow, 200);
  });

  // Hash support (&text=... &autoprint=1)
  const rawHash = location.hash.startsWith('#')?location.hash.slice(1):location.hash;
  if(rawHash){
    const params = new URLSearchParams(rawHash);
    const t = params.get('text'); const auto = params.get('autoprint');
    if(t){
      let decoded=''; try{decoded=decodeURIComponent(t);}catch{ try{decoded=atob(t);}catch{decoded=t;} }
      document.getElementById('src').value=decoded; filterNow();
      if(auto==='1' || (auto && auto.toLowerCase()==='true')) setTimeout(()=>window.print(),300);
      return;
    }
  }

  filterNow();
});