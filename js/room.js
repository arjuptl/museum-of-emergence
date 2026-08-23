/* ────────────────────────────────────────────────────────────────
   room.js — the entry point for a single-exhibit page.
   These pages exist so that every room has a real URL: one a search
   engine can index, an agent can cite, and a person can send to a
   friend. The essay is already in the HTML before this file runs —
   this only brings the simulation to life on top of it.
   ──────────────────────────────────────────────────────────────── */
import { byId } from './exhibits/index.js';

const host = document.getElementById('room-stage');
const id   = document.body.dataset.exhibit;
const ex   = byId[id];
if (host && ex){
  const canvas = document.createElement('canvas');
  host.appendChild(canvas);
  const dpr = Math.min(window.devicePixelRatio || 1, ex.gl ? 1.75 : 2);
  const fit = () => {
    const r = host.getBoundingClientRect();
    const w = Math.max(2, Math.round(r.width * dpr));
    const h = Math.max(2, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h){ canvas.width = w; canvas.height = h; return true; }
    return false;
  };
  fit();

  let inst = null;
  try { inst = ex.create(canvas, {preview:false, dpr}); } catch (err){ console.error(err); }

  if (!inst){
    canvas.remove();
    host.innerHTML = '<div class="gl-notice"><span>' + ex.title +
      '</span><small>This exhibit needs WebGL2 with float render targets.</small></div>';
  } else {
    // run the rule forward before the first paint, so the page never
    // opens on an empty plate
    try { for (let i = 0; i < (ex.prewarm || 0); i++) inst.step(1/60, i/60); } catch (e){}

    let last = 0, visible = true, raf = 0;
    const loop = t => {
      raf = requestAnimationFrame(loop);
      const dt = last ? Math.min((t - last)/1000, 0.1) : 0.016;
      last = t;
      if (document.hidden || !visible) return;
      try { inst.step(dt, t/1000); } catch (e){ cancelAnimationFrame(raf); console.error(e); }
    };
    requestAnimationFrame(loop);

    if ('IntersectionObserver' in window)
      new IntersectionObserver(es => { visible = es[0].isIntersecting; }, {threshold:0.01}).observe(host);

    let rt; addEventListener('resize', () => { clearTimeout(rt);
      rt = setTimeout(() => { if (fit()) inst.resize(); }, 180); }, {passive:true});

    // the same hands-on behaviour as the museum proper
    let down = false;
    const norm = e => { const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left)/r.width, (e.clientY - r.top)/r.height]; };
    const send = (e, d) => { const [x,y] = norm(e); inst.pointer(x, y, d, e.shiftKey); };
    canvas.addEventListener('pointerdown', e => { down = true; send(e, true); });
    canvas.addEventListener('pointermove', e => send(e, down));
    addEventListener('pointerup', e => { down = false; try { send(e, false); } catch(_){} });
    canvas.addEventListener('pointerleave', () => { down = false; inst.leave?.(); });

    const readout = document.getElementById('room-readout');
    if (readout) setInterval(() => { readout.textContent = inst.count?.() ?? ''; }, 500);

    document.getElementById('room-restart')?.addEventListener('click', () => inst.reset());
    addEventListener('keydown', e => {
      if (e.target.matches('input,select,textarea')) return;
      if (e.key === 'r' || e.key === 'R') inst.reset();
    });
  }
}
