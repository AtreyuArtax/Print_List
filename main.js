'use strict';

/* ===== Inline the external SVG sprite so <use href="#..."> works everywhere ===== */
async function loadSprite() {
  try {
    // cache-bust: append timestamp; and disable caching
    const url = `grocery-icons.svg?v=${Date.now()}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`sprite fetch failed: ${res.status}`);
    const svgText = await res.text();

    const holder = document.createElement('div');
    holder.style.position = 'absolute';
    holder.style.width = '0'; holder.style.height = '0';
    holder.style.overflow = 'hidden';
    holder.innerHTML = svgText;

    document.body.prepend(holder);

    // debug: confirm symbol count
    const count = holder.querySelectorAll('symbol[id^="i-"]').length;
    console.log(`[sprite] loaded ${count} symbols`);
  } catch (e) {
    console.warn('Could not load grocery-icons.svg; icons will be skipped.', e);
  }
}

/* ===== Load icon map (canonical keys + synonyms) from icon-map.json ===== */
let ICON_KEYS = new Set();   // "banana","broccoli",...
let SYNONYMS  = {};          // phrase/word -> canonical

async function loadIconMap(){
  const res = await fetch('./icon-map.json', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`icon-map.json fetch failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  ICON_KEYS = new Set(data.canonical || []);
  SYNONYMS  = data.synonyms || {};
  console.log('[icon-map] loaded:', ICON_KEYS.size, 'keys,', Object.keys(SYNONYMS).length, 'synonyms');
}


/* -------- Parsing -------- */
const re = {
  atx: /^\s*(#{1,6})\s+(.*)\s*$/,
  mdUnchecked: /^\s*[-*+]\s*\[\s\]\s+(.*)$/,
  mdChecked:   /^\s*[-*+]\s*\[[xX]\]\s+(.*)$/,
  yourChecked: /^\s*✓\s+(.*)$/,
  yourUnchecked:/^\s*◦\s+(.*)$/,
  fallbackBullet:/^\s*[-*+]\s+(.*)$/
};
function parseMarkdownList(src){
  const lines = src.split(/\r?\n/);
  let title=null; const sections=[]; let currentSection=null;
  function ensureSection(name){ currentSection={name:name.trim(),items:[]}; sections.push(currentSection); }
  for(const raw of lines){
    const line = raw.replace(/\s+$/,''); if(!line.trim()) continue;
    const mAtx = line.match(re.atx);
    if(mAtx){ const level=mAtx[1].length; const text=mAtx[2].trim(); if(level===1 && !title){title=text;} else {ensureSection(text);} continue; }
    let isItem=false, checked=false, text=""; let m;
    if((m=line.match(re.mdChecked))){ isItem=true; checked=true;  text=m[1]; }
    else if((m=line.match(re.mdUnchecked))){ isItem=true; checked=false; text=m[1]; }
    else if((m=line.match(re.yourChecked))){ isItem=true; checked=true;  text=m[1]; }
    else if((m=line.match(re.yourUnchecked))){ isItem=true; checked=false; text=m[1]; }
    else if((m=line.match(re.fallbackBullet))){ isItem=true; checked=false; text=m[1]; }
    if(isItem){ if(!currentSection) ensureSection('Items'); if(!checked) currentSection.items.push(text.trim()); continue; }
    if(!title){ title=line.trim(); } else { ensureSection(line.trim()); }
  }
  return { title: title||'List', sections: sections.filter(s=>s.items.length>0) };
}

/* -------- Quadrant packing -------- */
function flowIntoQuadrants(sections){
  const quads = [[],[],[],[]]; // TL, TR, BL, BR
  const weights = sections.map(s => 1 + s.items.length);
  const total = weights.reduce((a,b)=>a+b,0);
  const target = Math.max(1, Math.round(total/4));
  let qi = 0, acc = 0;
  for(let i=0;i<sections.length;i++){
    const s = sections[i];
    const w = weights[i];
    if(qi > 3) qi = 3;
    quads[qi].push(s);
    acc += w;
    if(acc >= target && qi < 3){ qi++; acc = 0; }
  }
  return quads;
}

/* -------- Icon matching -------- */
function normalize(s){
  return s.toLowerCase()
    .normalize('NFKD').replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9\s]/g,' ')
    .replace(/\s+/g,' ').trim();
}
function singularize(w){
  if(/(ies)$/.test(w)) return w.replace(/ies$/,'y');
  if(/(oes)$/.test(w)) return w.replace(/es$/,'o');
  if(/(ches|shes|xes|zes)$/.test(w)) return w.replace(/es$/,'');
  if(/s$/.test(w) && !/(ss|us)$/.test(w)) return w.replace(/s$/,'');
  return w;
}
function pickIconKey(text){
  const norm = normalize(text);
  if (SYNONYMS[norm] && ICON_KEYS.has(SYNONYMS[norm])) return SYNONYMS[norm];
  const underscored = norm.replace(/\s+/g,'_');
  if (SYNONYMS[underscored] && ICON_KEYS.has(SYNONYMS[underscored])) return SYNONYMS[underscored];
  if (ICON_KEYS.has(norm)) return norm;
  const words = norm.split(' ');
  for (const w of words){
    const s = singularize(w);
    if (SYNONYMS[s] && ICON_KEYS.has(SYNONYMS[s])) return SYNONYMS[s];
    if (ICON_KEYS.has(s)) return s;
  }
  for (const syn in SYNONYMS){
    const phrase = syn.replace(/_/g,' ');
    if (norm.includes(phrase) && ICON_KEYS.has(SYNONYMS[syn])) return SYNONYMS[syn];
  }
  return null;
}
function createSvgUse(id){
  const span = document.createElement('span');
  span.className = 'icon';
  // Add xlink:href for Edge/WebKit/Safari robustness
  span.innerHTML =
    `<svg viewBox="0 0 24 24" aria-hidden="true">
       <use href="#${id}" xlink:href="#${id}"></use>
     </svg>`;
  return span;
}

/* -------- Render -------- */
function renderQuadrants(model){
  const out = document.getElementById('out'); out.innerHTML = '';

  const title = document.createElement('div');
  title.className='list-title';
  title.textContent = model.title;
  out.appendChild(title);

  if(model.sections.length===0){
    const p=document.createElement('div');
    p.className='empty-note'; p.textContent='All items are checked. Nothing left to buy 🎉';
    out.appendChild(p); return;
  }

  const grid = document.createElement('div'); grid.className='grid4'; out.appendChild(grid);
  const quads = flowIntoQuadrants(model.sections);

  for(let q=0;q<4;q++){
    const box = document.createElement('div'); box.className='quad'; grid.appendChild(box);
    for(const section of quads[q]){
      const sec = document.createElement('section'); sec.className='section';
      const h = document.createElement('h2'); h.textContent = section.name; sec.appendChild(h);
      const ul = document.createElement('ul'); ul.className='items';
      for(const item of section.items){
        const li=document.createElement('li'); li.className='item';
        const cb=document.createElement('span'); cb.className='cb'; cb.setAttribute('aria-hidden','true');

        const label=document.createElement('span'); label.className='item-label';
        label.textContent=item;

        const key = pickIconKey(item);
        // console.debug('match?', item, '→', key); // <- enable if debugging
        if (key){ label.appendChild(createSvgUse('i-' + key)); }

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

/* -------- Text size control -------- */
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

/* -------- Init & events -------- */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadSprite();
    await loadIconMap();
  } catch (e) {
    console.error(e);
    alert('Could not load icon-map.json. Check path/filename/hosting. Icons may be missing.');
  }

  const sel = document.getElementById('opt-size');
  const saved = localStorage.getItem('optSize');
  if(saved && sizeMap[saved]) sel.value = saved;
  applyTextSize(sel.value);
  sel.addEventListener('change', ()=>{
    localStorage.setItem('optSize', sel.value);
    applyTextSize(sel.value);
  });

  document.getElementById('btn-print').addEventListener('click', ()=>window.print());
  document.getElementById('btn-sample').addEventListener('click', async ()=>{
    try{
      const res = await fetch('sample.md', { cache: 'no-store' });
      const text = await res.text();
      document.getElementById('src').value = text;
      filterNow();
    }catch(e){
      alert('Could not load sample.md');
    }
  });

  // Auto-render (debounced)
  let _tid;
  document.getElementById('src').addEventListener('input', ()=>{
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
