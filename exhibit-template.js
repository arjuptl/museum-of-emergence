/* ════════════════════════════════════════════════════════════════════════
   THE MUSEUM OF EMERGENCE — exhibit template

   This file is a complete, working exhibit. It is not hung in the museum;
   it exists so you can see the whole contract in one place and copy it.

   The model implemented here is Mitchel Resnick's termite / wood-chip world
   (StarLogo, 1994): termites wander at random, pick up a chip if they find
   one, and put it down again when they bump into another chip. No termite
   can see a pile, count a pile, or intend a pile. Piles appear anyway, and
   then slowly eat each other until one is left.

   TO CONTRIBUTE AN EXHIBIT
     1. Copy this file to js/exhibits/<your-id>.js
     2. Implement your model. Keep the same exported shape.
     3. Register it in js/exhibits/index.js
     4. Open a pull request.

   HARD CONSTRAINTS — a submission that breaks one of these cannot be merged:
     · No dependencies. No npm, no CDN, no bundler, no build step.
       Vanilla ES modules and the platform, exactly like every other exhibit.
     · No network access of any kind at runtime. The site ships a
       Content-Security-Policy of `connect-src 'none'`; fetch and XHR simply
       do not work here. Do not try to route around it.
     · No cookies, no storage, no telemetry, no fingerprinting.
     · No eval, no new Function, no dynamic import of remote code.
     · It must be YOUR implementation of a PUBLISHED model, and you must cite
       the paper. Do not paste someone else's code; do not invent a citation.
     · It must hold 60fps at 1440×900 on integrated graphics. Give the
       expensive knobs a sane default and let visitors turn them up.
     · Clean up after yourself in destroy().

   Everything here is MIT licensed. By opening a pull request you agree your
   contribution is licensed the same way, and is yours to give.
   ════════════════════════════════════════════════════════════════════════ */

export default {
  /* ── wall label ─────────────────────────────────────────────────────── */
  id:       'termites',              // unique, lowercase, used in the URL: #/termites
  title:    'Termites',              // one word if you can manage it
  subtitle: 'Resnick’s wood-chip world',
  attr:     'Mitchel Resnick · 1994',
  accent:   '#c9a86a',               // one colour; the whole room is tinted with it
  desc:     'Termites that cannot see a pile, count a pile, or want a pile. '
          + 'Piles appear regardless, and then devour one another.',

  // The placard essay. Plain HTML: <b>, <em>, <br> only. Write for a curious
  // adult who has never heard of this. Say what is surprising and why.
  text: `A termite here knows two things: whether it is carrying a wood chip,
         and what is directly underneath it. If it is empty-handed and standing
         on a chip, it picks the chip up. If it is carrying one and bumps into
         another, it puts its own down nearby. Otherwise it wanders.<br><br>
         That is the whole program, and it contains no representation of a pile.
         Yet piles form within seconds — and then something stranger happens.
         The number of piles falls, and keeps falling, because a pile can only
         lose its last chip once. Piles are absorbing states with no way back,
         so the system ratchets toward a single heap.<br><br>
         <em>Nobody is consolidating anything.</em> The ratchet is a statistical
         consequence of a rule about two adjacent squares.`,

  // The rule, exactly, as a visitor could reimplement it. Keep it honest.
  code: `for each termite, every frame:

    step one square in a random direction

    if not carrying and this square has a chip:
        pick it up, leave the square empty

    else if carrying and this square has a chip:
        step away until an empty square is found
        put the chip down there

no termite has any notion of "pile".`,

  hint: 'Watch the pile count fall. It only ever falls.',
  ref:  '<b>Resnick, M.</b> (1994) <i>Turtles, Termites and Traffic Jams</i>. MIT Press.',

  gl:      false,   // true if you take a WebGL2 context, false for Canvas 2D
  prewarm: 60,      // frames to run before the first paint, so nobody meets a blank plate

  /* ── the knobs a visitor gets ───────────────────────────────────────────
     Numbers become sliders, `options` becomes a dropdown. `val` is the
     default. Optional: `unit` (appended) or `fmt` (a formatter function).   */
  params: [
    {k:'termites', label:'Termites',  min:50,  max:2000, step:10,  val:600},
    {k:'chips',    label:'Wood chips',min:0.02,max:0.35, step:0.01,val:0.14,
                   fmt:v => Math.round(v*100) + '%'},
    {k:'speed',    label:'Steps / frame', min:1, max:24, step:1,   val:6}
  ],

  /* ── the exhibit itself ─────────────────────────────────────────────────
     `create` is handed a <canvas> that is already sized in device pixels.
     Return an object with the methods below. `opts.preview` is true for the
     small live thumbnail on the atrium page — use it to scale work down.    */
  create(canvas, opts = {}){
    const preview = !!opts.preview;
    const ctx = canvas.getContext('2d', {alpha:false});
    const dpr = opts.dpr || 1;

    const P = {termites: preview ? 220 : 600, chips:0.14, speed: preview ? 3 : 6};
    if (opts.params) Object.assign(P, opts.params);

    const CELL = preview ? 3 : 4;              // world cells are CELL device px
    let W, H, grid, tx, ty, carry, piles = 0;

    function build(){
      W = Math.max(8, Math.floor(canvas.width  / (CELL * dpr)));
      H = Math.max(8, Math.floor(canvas.height / (CELL * dpr)));
      grid = new Uint8Array(W * H);
      for (let i = 0; i < grid.length; i++) grid[i] = Math.random() < P.chips ? 1 : 0;
      const n = Math.round(P.termites);
      tx = new Int32Array(n); ty = new Int32Array(n); carry = new Uint8Array(n);
      for (let i = 0; i < n; i++){
        tx[i] = (Math.random() * W) | 0;
        ty[i] = (Math.random() * H) | 0;
      }
    }
    build();

    const DX = [1,-1,0,0], DY = [0,0,1,-1];
    const wrap = (v, m) => v < 0 ? v + m : v >= m ? v - m : v;

    function tick(){
      for (let i = 0; i < tx.length; i++){
        const d = (Math.random() * 4) | 0;
        const x = wrap(tx[i] + DX[d], W), y = wrap(ty[i] + DY[d], H);
        tx[i] = x; ty[i] = y;
        const k = y * W + x;
        if (!carry[i] && grid[k]){ grid[k] = 0; carry[i] = 1; }
        else if (carry[i] && grid[k]){
          // walk until a free square turns up, then drop
          for (let a = 0; a < 12; a++){
            const e = (Math.random() * 4) | 0;
            const nx = wrap(tx[i] + DX[e], W), ny = wrap(ty[i] + DY[e], H);
            tx[i] = nx; ty[i] = ny;
            const j = ny * W + nx;
            if (!grid[j]){ grid[j] = 1; carry[i] = 0; break; }
          }
        }
      }
    }

    function step(){
      if (Math.floor(canvas.width / (CELL*dpr)) !== W) build();
      for (let s = 0; s < Math.round(P.speed); s++) tick();

      ctx.fillStyle = '#0a0b0e';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const c = CELL * dpr;
      ctx.fillStyle = '#c9a86a';
      let count = 0;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (grid[y*W + x]){ ctx.fillRect(x*c, y*c, c - 0.6, c - 0.6); count++; }
      ctx.fillStyle = 'rgba(255,240,210,0.85)';
      for (let i = 0; i < tx.length; i++)
        if (carry[i]) ctx.fillRect(tx[i]*c, ty[i]*c, c - 0.6, c - 0.6);
      piles = count;
    }

    /* Every method below is required. `pointer` and `resize` may be no-ops. */
    return {
      step,                                        // (dt, t) => advance and draw
      set(k, v){ P[k] = v; if (k !== 'speed') build(); },
      get(k){ return P[k]; },
      reset(){ build(); },
      resize(){ build(); },
      pointer(x, y, down, shift){},                // x, y are 0..1; y down
      count(){ return tx.length.toLocaleString() + ' termites · '
                    + piles.toLocaleString() + ' chips · ' + W + '×' + H; },
      destroy(){}                                  // free GL objects, timers, workers
    };
  }
};
