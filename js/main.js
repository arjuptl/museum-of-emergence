/* ════════════════════════════════════════════════════════════════
   main.js — the building. Doors, lighting, wall labels, and a
   single heartbeat that drives every exhibit in the place.
   ════════════════════════════════════════════════════════════════ */
import { EXHIBITS, byId } from './exhibits/index.js';

const $  = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

/* ─────────────── one clock for the whole museum ─────────────── */
const Clock = {
  jobs: new Set(),
  raf: 0, last: 0,
  add(j){ this.jobs.add(j); this.start(); return j; },
  remove(j){ this.jobs.delete(j); },
  start(){ if (!this.raf) this.raf = requestAnimationFrame(this.tick); },
  tick: t => {
    const C = Clock;
    C.raf = requestAnimationFrame(C.tick);
    const dt = C.last ? Math.min((t - C.last) / 1000, 0.1) : 0.016;
    C.last = t;
    if (document.hidden) return;
    for (const j of C.jobs){
      if (!j.visible || j.paused || !j.inst) continue;
      if (j.interval){                       // throttled (gallery previews)
        j.acc = (j.acc || 0) + dt;
        if (j.acc < j.interval) continue;
        j.acc = 0;
      }
      try { j.inst.step(j.interval || dt, t / 1000); }
      catch (err){ console.error('[' + j.id + ']', err); j.paused = true; }
      if (j.onFrame) j.onFrame(dt);
    }
  }
};

/* ─────────────── canvas sizing ─────────────── */
function fit(canvas, maxDpr = 2){
  const r = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  const w = Math.max(2, Math.round(r.width  * dpr));
  const h = Math.max(2, Math.round(r.height * dpr));
  if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; return dpr; }
  return 0;
}

function mount(host, exhibit, {preview = false, params = null, maxDpr = 2} = {}){
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const r = host.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return {canvas:null, inst:null, dpr:1, deferred:true};
  const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
  canvas.width  = Math.max(2, Math.round(r.width  * dpr));
  canvas.height = Math.max(2, Math.round(r.height * dpr));
  let inst = null;
  try { inst = exhibit.create(canvas, {preview, params, dpr}); }
  catch (err){ console.error('could not open ' + exhibit.id, err); }
  // Run the rule forward before the first paint. Emergence takes a few
  // hundred ticks, and nobody should have to watch a black rectangle for it.
  if (inst && exhibit.prewarm){
    const n = Math.round(exhibit.prewarm * (preview ? 0.55 : 1));
    try { for (let i = 0; i < n; i++) inst.step(1/60, i/60); }
    catch (err){ console.warn('warm-up failed for ' + exhibit.id, err); }
  }

  if (!inst){                                   // no WebGL2? hang a wall label instead
    canvas.remove();
    const p = document.createElement('div');
    p.className = 'gl-notice';
    p.innerHTML = '<span>' + exhibit.title + '</span><small>This exhibit needs WebGL2 with float render targets.</small>';
    host.appendChild(p);
    return {canvas:null, inst:null, dpr};
  }
  return {canvas, inst, dpr};
}

/* ═══════════════════════ THE ATRIUM ═══════════════════════ */
const ROMAN = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];

function buildGallery(){
  const grid = $('#gallery-grid');
  const frag = document.createDocumentFragment();

  EXHIBITS.forEach((ex, i) => {
    const a = document.createElement('a');
    a.className = 'card';
    a.href = '#/' + ex.id;
    a.style.setProperty('--card-accent', ex.accent);
    a.innerHTML = `
      <div class="card-tape"></div>
      <div class="card-frame"><span class="card-badge">${ex.gl ? 'WebGL2' : 'Canvas'}</span></div>
      <div class="card-meta">
        <span class="card-num">Room ${ROMAN[i]} · ${ex.subtitle}</span>
        <h3 class="card-title">${ex.title}</h3>
        <p class="card-attr">${ex.attr.split('·')[0].trim()}</p>
        <p class="card-desc">${ex.desc}</p>
      </div>`;
    frag.appendChild(a);

    const frame = a.querySelector('.card-frame');
    const job = {id:'card-' + ex.id, visible:true, paused:false, inst:null,
                 interval: 1/30, host:frame, ex, mounted:false};
    Clock.add(job);
    a._job = job;
  });

  // Room IX is not a simulation — it is the rule by which the museum grows.
  const door = document.createElement('a');
  door.className = 'card card-door';
  door.href = 'agents.html';
  door.innerHTML = `
    <div class="card-tape"></div>
    <div class="card-frame door-frame">
      <div class="door-mark" aria-hidden="true"><span></span><span></span><span></span></div>
      <p class="door-kick">Unfinished, deliberately</p>
    </div>
    <div class="card-meta">
      <span class="card-num">Room IX · The rule the museum itself follows</span>
      <h3 class="card-title">The Open Door</h3>
      <p class="card-attr">For visitors who are not people</p>
      <p class="card-desc">Eight rooms, and space for more. One local rule for
      adding one — followed alone, by anyone, human or otherwise.</p>
    </div>`;
  frag.appendChild(door);

  grid.appendChild(frag);

  // Build the previews on a stagger rather than waiting on IntersectionObserver.
  // IO notifications ride the rendering steps, which a background tab pauses
  // entirely — cards would then never appear at all. One per tick keeps the
  // atrium responsive while every card comes up ready.
  const queue = $$('.card');
  (function mountNext(){
    const card = queue.shift();
    if (!card) return;
    const job = card._job;
    const m = mount(job.host, job.ex, {preview:true, maxDpr:1.35});
    if (m.deferred){ queue.push(card); setTimeout(mountNext, 220); return; }
    job.mounted = true; job.inst = m.inst; job.canvas = m.canvas;
    setTimeout(mountNext, 90);
  })();

  // IO is now only a power switch: stop drawing what nobody is looking at.
  if ('IntersectionObserver' in window){
    const io = new IntersectionObserver(entries => {
      for (const e of entries) if (e.target._job) e.target._job.visible = e.isIntersecting;
    }, {rootMargin:'260px 0px'});
    $$('.card').forEach(c => io.observe(c));
  }

  // references, drawn from the exhibits themselves
  $('#refs').innerHTML = EXHIBITS.map(e => '<li>' + e.ref + '</li>').join('');
}

/* ─────────────── the hero: slime, running slow ─────────────── */
let heroJob = null;
function buildHero(){
  const canvas = $('#hero-canvas');
  const dpr = fit(canvas, 1.6) || Math.min(window.devicePixelRatio || 1, 1.6);
  const ex = byId.slime;
  let inst = null;
  try {
    inst = ex.create(canvas, {preview:false, dpr, params:{
      sense:21, turn:41, dist:6, step:0.85, decay:0.905, blur:0.24, gain:0.52, palette:0
    }});
  } catch(e){ console.warn('hero unavailable', e); }
  if (!inst){ canvas.style.display = 'none'; return; }
  // The atrium wall should already be alive when the doors open.
  try { for (let i = 0; i < 340; i++) inst.step(1/60, i/60); }
  catch (err){ console.warn('hero warm-up failed', err); }
  $('#hero-credit').innerHTML = 'Room II<br>Slime<br>Physarum, live';
  heroJob = Clock.add({id:'hero', visible:true, paused:false, inst});
  addEventListener('resize', () => { if (fit(canvas, 1.6)) inst.resize(); }, {passive:true});

  const hero = $('.hero');
  const io = new IntersectionObserver(es => { heroJob.visible = es[0].isIntersecting && !Stage.open; },
                                      {threshold:0.02});
  io.observe(hero);

  // let visitors stir the atrium wall
  let down = false;
  const norm = e => {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };
  hero.addEventListener('pointermove', e => { const [x,y] = norm(e); inst.pointer(x, y, down, e.shiftKey); }, {passive:true});
  hero.addEventListener('pointerdown', e => { down = true; const [x,y] = norm(e); inst.pointer(x, y, true, e.shiftKey); }, {passive:true});
  addEventListener('pointerup', () => { down = false; inst.pointer(0, 0, false); }, {passive:true});
}

/* ═══════════════════════ THE EXHIBIT ROOM ═══════════════════════ */
const Stage = {
  open:false, ex:null, inst:null, canvas:null, job:null, dpr:1,
  fpsSamples:[], lastFpsPaint:0,

  enter(id){
    const ex = byId[id];
    if (!ex) return this.leave();
    if (this.ex && this.ex.id === id) return;
    this.close();

    this.ex = ex;
    document.body.classList.add('no-scroll');
    $('#exhibit').hidden = false;
    $('#atrium').setAttribute('aria-hidden', 'true');
    this.open = true;
    if (heroJob) heroJob.visible = false;
    for (const j of Clock.jobs) if (j.id.startsWith('card-')) j.paused = true;

    document.documentElement.style.setProperty('--accent', ex.accent);

    const host = $('#stage');
    host.innerHTML = '';
    const m = mount(host, ex, {preview:false, maxDpr: ex.gl ? 1.75 : 2});
    this.inst = m.inst; this.canvas = m.canvas; this.dpr = m.dpr;

    this.fillPlacard(ex);
    this.buildControls(ex);
    this.wirePointer();

    this.fpsSamples = [];
    this.job = Clock.add({
      id:'stage', visible:true, paused:false, inst:this.inst,
      onFrame: dt => this.meter(dt)
    });

    const i = EXHIBITS.indexOf(ex);
    $('#tb-room').textContent = ex.title + ' — ' + ex.subtitle;
    $('#tb-index').textContent = String(i+1).padStart(2,'0') + ' / ' + String(EXHIBITS.length).padStart(2,'0');
    $('#act-play-label').textContent = 'Pause';
    document.title = ex.title + ' · The Museum of Emergence';
  },

  close(){
    if (this.job) Clock.remove(this.job);
    try { this.inst?.destroy(); } catch(e){}
    $('#stage').innerHTML = '';
    this.inst = null; this.canvas = null; this.job = null; this.ex = null;
  },

  leave(){
    this.close();
    this.open = false;
    $('#exhibit').hidden = true;
    $('#atrium').removeAttribute('aria-hidden');
    document.body.classList.remove('no-scroll');
    document.documentElement.style.setProperty('--accent', '#e0c589');
    if (heroJob) heroJob.visible = true;
    for (const j of Clock.jobs) if (j.id.startsWith('card-')) j.paused = false;
    document.title = 'The Museum of Emergence';
    Wander.stop();
  },

  fillPlacard(ex){
    const i = EXHIBITS.indexOf(ex);
    $('#p-num').textContent   = 'Room ' + ROMAN[i] + ' · ' + ex.subtitle;
    $('#p-title').textContent = ex.title;
    $('#p-attr').textContent  = ex.attr;
    $('#p-text').innerHTML    = ex.text;
    $('#p-code').textContent  = ex.code;
    $('#p-hint').textContent  = ex.hint;
    $('#p-rule-wrap').open = false;
    $('.placard-scroll').scrollTop = 0;
  },

  buildControls(ex){
    const box = $('#p-controls');
    box.innerHTML = '';
    this.controls = {};
    for (const p of ex.params){
      const wrap = document.createElement('div');
      wrap.className = 'ctrl';
      if (p.options){
        wrap.innerHTML = `<label>${p.label}</label>`;
        const sel = document.createElement('select');
        p.options.forEach((o, idx) => {
          const opt = document.createElement('option');
          opt.value = idx; opt.textContent = o;
          sel.appendChild(opt);
        });
        sel.value = String(Math.round(this.inst?.get(p.k) ?? p.val));
        sel.addEventListener('change', () => this.apply(p.k, +sel.value));
        wrap.appendChild(sel);
        this.controls[p.k] = {el:sel, def:p};
      } else {
        const cur = this.inst?.get(p.k) ?? p.val;
        wrap.innerHTML =
          `<label>${p.label}<b data-v="${p.k}">${fmt(p, cur)}</b></label>` +
          `<input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${cur}">`;
        const inp = wrap.querySelector('input');
        inp.addEventListener('input', () => this.apply(p.k, +inp.value));
        this.controls[p.k] = {el:inp, def:p, out:wrap.querySelector('b')};
      }
      box.appendChild(wrap);
    }
  },

  apply(k, v){
    if (!this.inst) return;
    const echo = this.inst.set(k, v);
    const c = this.controls[k];
    if (c && c.out) c.out.textContent = fmt(c.def, v);
    if (c && c.el.type === 'range') c.el.value = v;
    if (echo) for (const [kk, vv] of Object.entries(echo)){   // e.g. a preset moving sliders
      const c2 = this.controls[kk];
      if (!c2) continue;
      c2.el.value = vv;
      if (c2.out) c2.out.textContent = fmt(c2.def, vv);
    }
  },

  shuffle(){
    const skip = new Set(['count','budget','rows','scale','speed','trail','R','T','seed','start','mode']);
    for (const p of this.ex.params){
      if (skip.has(p.k)) continue;
      let v;
      if (p.options) v = Math.floor(Math.random() * p.options.length);
      else {
        const t = 0.14 + Math.random() * 0.72;              // stay off the extremes
        v = p.min + (p.max - p.min) * t;
        v = Math.round(v / p.step) * p.step;
        v = +v.toFixed(6);
      }
      this.apply(p.k, v);
    }
  },

  wirePointer(){
    const c = this.canvas;
    if (!c || !this.inst) return;
    let down = false;
    const norm = e => {
      const r = c.getBoundingClientRect();
      return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
    };
    const send = (e, isDown) => { const [x,y] = norm(e); this.inst.pointer(x, y, isDown, e.shiftKey); };
    c.addEventListener('pointerdown', e => { down = true; c.setPointerCapture?.(e.pointerId); send(e, true); });
    c.addEventListener('pointermove', e => send(e, down));
    c.addEventListener('pointerup',    e => { down = false; send(e, false); });
    c.addEventListener('pointercancel',() => { down = false; this.inst.pointer(0,0,false); });
    c.addEventListener('pointerleave', () => { down = false; this.inst.leave?.(); this.inst.pointer(-1,-1,false); });
  },

  meter(dt){
    this.fpsSamples.push(1/Math.max(dt, 1e-4));
    if (this.fpsSamples.length > 40) this.fpsSamples.shift();
    const now = performance.now();
    if (now - this.lastFpsPaint < 420) return;
    this.lastFpsPaint = now;
    const avg = this.fpsSamples.reduce((a,b)=>a+b,0) / this.fpsSamples.length;
    $('#p-fps-val').textContent = avg.toFixed(0);
    $('#p-count').textContent = this.inst?.count?.() ?? '';
  },

  resize(){
    if (!this.open || !this.canvas || !this.inst) return;
    if (fit(this.canvas, this.ex.gl ? 1.75 : 2)) this.inst.resize();
  },

  snapshot(){
    if (!this.canvas) return;
    const a = document.createElement('a');
    a.download = 'museum-of-emergence-' + this.ex.id + '-' + Date.now() + '.png';
    a.href = this.canvas.toDataURL('image/png');
    a.click();
  },

  go(delta){
    const i = EXHIBITS.indexOf(this.ex);
    const n = (i + delta + EXHIBITS.length) % EXHIBITS.length;
    location.hash = '#/' + EXHIBITS[n].id;
  }
};

function fmt(p, v){
  if (p.fmt) return p.fmt(+v);
  const s = (p.step < 1) ? (+v).toFixed(String(p.step).split('.')[1]?.length || 2) : String(Math.round(v));
  return s + (p.unit || '');
}

/* ─────────────── wander: an automated docent ─────────────── */
const Wander = {
  on:false, t0:0, span:26000, raf:0,
  toggle(){ this.on ? this.stop() : this.start(); },
  start(){
    this.on = true;
    $('#wander-btn').dataset.on = '1';
    $('#wander-btn').textContent = 'Stop wandering';
    $('#wander-bar').hidden = false;
    if (!Stage.open) location.hash = '#/' + EXHIBITS[0].id;
    this.t0 = performance.now();
    const loop = () => {
      if (!this.on) return;
      this.raf = requestAnimationFrame(loop);
      const p = (performance.now() - this.t0) / this.span;
      $('#wander-fill').style.width = Math.min(1, p) * 100 + '%';
      if (p >= 1){ this.t0 = performance.now(); Stage.go(1); }
    };
    loop();
  },
  stop(){
    if (!this.on) return;
    this.on = false; cancelAnimationFrame(this.raf);
    $('#wander-btn').dataset.on = '0';
    $('#wander-btn').textContent = 'Wander the halls';
    $('#wander-bar').hidden = true;
  }
};

/* ─────────────── routing ─────────────── */
function route(){
  const h = location.hash;
  if (h.startsWith('#/')){
    const id = h.slice(2);
    if (byId[id]){ Stage.enter(id); return; }
  }
  if (Stage.open) Stage.leave();
}

/* ─────────────── wiring ─────────────── */
function wire(){
  addEventListener('hashchange', route);

  $('#tb-back').addEventListener('click', e => { e.preventDefault(); Wander.stop(); location.hash = ''; 
    history.replaceState(null,'',location.pathname + location.search); route(); });
  $('#prev-btn').addEventListener('click', () => Stage.go(-1));
  $('#next-btn').addEventListener('click', () => Stage.go(1));
  $('#wander-btn').addEventListener('click', () => Wander.toggle());

  $('#act-reset').addEventListener('click', () => Stage.inst?.reset());
  $('#act-shuffle').addEventListener('click', () => Stage.shuffle());
  $('#act-shot').addEventListener('click', () => Stage.snapshot());
  $('#act-play').addEventListener('click', () => {
    if (!Stage.job) return;
    Stage.job.paused = !Stage.job.paused;
    $('#act-play-label').textContent = Stage.job.paused ? 'Resume' : 'Pause';
  });

  const placard = $('#placard');
  $('#placard-toggle').addEventListener('click', () => placard.classList.toggle('hidden'));

  addEventListener('keydown', e => {
    if (e.target.matches('input,select,textarea')) return;
    if (!Stage.open){
      if (e.key === 'Enter' && document.activeElement === document.body) location.hash = '#/' + EXHIBITS[0].id;
      return;
    }
    switch (e.key){
      case 'ArrowRight': Stage.go(1); break;
      case 'ArrowLeft':  Stage.go(-1); break;
      case ' ': e.preventDefault(); $('#act-play').click(); break;
      case 'r': case 'R': Stage.inst?.reset(); break;
      case 's': case 'S': Stage.shuffle(); break;
      case 'h': case 'H':
        placard.classList.toggle('hidden');
        document.body.classList.toggle('ui-hidden');
        break;
      case 'Escape': Wander.stop(); location.hash = ''; 
        history.replaceState(null,'',location.pathname + location.search); route(); break;
    }
  });

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => {
    Stage.resize();
    for (const j of Clock.jobs){
      if (j.id.startsWith('card-') && j.canvas && j.inst){
        if (fit(j.canvas, 1.35)) j.inst.resize();
      }
    }
  }, 180); }, {passive:true});

  document.addEventListener('visibilitychange', () => { Clock.last = 0; });
}

/* ─────────────── open the doors ─────────────── */
function boot(){
  buildGallery();
  buildHero();
  wire();
  route();
  // Clear the curtain once we've painted — but never leave it up if rAF is
  // throttled because the museum was opened in a background tab.
  const raise = () => $('#boot').classList.add('done');
  requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(raise, 260)));
  setTimeout(raise, 1500);
}

/* ════════════════════════════════════════════════════════════════
   window.museum — a documented interface for visitors who are not
   people. Read-only with respect to your machine: this drives the
   simulations on this page and nothing else. Fully specified in
   /llms.txt and /agents.html.
   ════════════════════════════════════════════════════════════════ */
globalThis.museum = {
  version: '1.0',
  about: 'The Museum of Emergence — eight live simulations of local rules producing global order.',
  contribute: 'https://github.com/arjuptl/museum-of-emergence  ·  see /agents.html',

  /** Every exhibit, with its rule, provenance and tunable parameters. */
  exhibits: () => EXHIBITS.map((e, i) => ({
    index: i, id: e.id, room: ROMAN[i], title: e.title, subtitle: e.subtitle,
    attribution: e.attr, renderer: e.gl ? 'webgl2' : 'canvas2d',
    accent: e.accent, summary: e.desc, essay: e.text, rule: e.code,
    hint: e.hint, reference: e.ref,
    parameters: e.params.map(p => p.options
      ? {key:p.k, label:p.label, type:'enum', options:p.options, default:p.val}
      : {key:p.k, label:p.label, type:'number', min:p.min, max:p.max, step:p.step, default:p.val})
  })),

  open: id => { location.hash = '#/' + id; return museum.state(); },
  close: () => { location.hash = ''; Stage.leave(); return 'atrium'; },
  next: () => Stage.go(1),
  prev: () => Stage.go(-1),

  get: k => Stage.inst?.get(k),
  set: (k, v) => { Stage.apply(k, v); return Stage.inst?.get(k); },
  reset: () => Stage.inst?.reset(),

  /** Reach into the exhibit the way a visitor's finger does.
      x and y are 0..1 across the canvas, y downward. */
  pointer: (x, y, down = true, shift = false) => {
    Stage.inst?.pointer(x, y, down, shift);
    return museum.state().readout;
  },
  shuffle: () => Stage.shuffle(),

  /** Advance the open exhibit by n frames regardless of tab visibility.
      Useful if you are a headless agent and rAF is throttled to nothing. */
  step(n = 1){
    const targets = Stage.inst
      ? [Stage.inst]
      : [...Clock.jobs].filter(j => j.inst && (j.id === 'hero' || j.id.startsWith('card-')))
                       .map(j => j.inst);
    if (!targets.length) return 0;
    for (let i = 0; i < n; i++) for (const t of targets) t.step(1/60, i/60);
    return n;
  },

  /** A PNG data URL of the current frame. */
  frame: () => Stage.canvas?.toDataURL('image/png') ?? null,

  state: () => ({
    open: Stage.open, exhibit: Stage.ex?.id ?? null,
    paused: Stage.job?.paused ?? null,
    readout: Stage.inst?.count?.() ?? null,
    params: Stage.ex ? Object.fromEntries(Stage.ex.params.map(p => [p.k, Stage.inst?.get(p.k)])) : null
  })
};

if (document.readyState === 'loading') addEventListener('DOMContentLoaded', boot);
else boot();
