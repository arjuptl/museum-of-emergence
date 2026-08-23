/* ════════════════════════════════════════════════════════════════
   VII · DENDRITE  —  Diffusion-limited aggregation (Witten & Sander, 1981)
   Particles wander at random until they touch something, then stop.
   The result is not random. It is the shape of frost, of copper
   deposits, of lightning, of a lung.
   ════════════════════════════════════════════════════════════════ */

const RAMPS = {
  'Hoarfrost': [[10,16,28],  [26,64,104],  [96,168,214],  [232,248,255]],
  'Copper':    [[18,10,8],   [86,38,18],   [206,122,52],  [255,232,190]],
  'Nebula':    [[14,10,24],  [62,30,86],   [168,86,180],  [246,220,255]],
  'Silver':    [[14,14,16],  [58,60,66],   [150,154,162], [255,255,255]]
};
const RAMP_NAMES = Object.keys(RAMPS);

/* smooth 4-stop interpolation; stop 0 is the core, stop 3 the growing tips */
function shade(stops, t){
  t = Math.max(0, Math.min(1, t)) * 3;
  const i = Math.min(2, t | 0);
  let f = t - i;
  f = f * f * (3 - 2 * f);
  const a = stops[i], b = stops[i + 1];
  return [a[0] + (b[0]-a[0])*f, a[1] + (b[1]-a[1])*f, a[2] + (b[2]-a[2])*f];
}

export default {
  id:'dendrite', num:'VII', roman:'VII',
  title:'Dendrite',
  subtitle:'Diffusion-limited aggregation',
  attr:'Witten & Sander · 1981',
  accent:'#9fc9e0',
  desc:'A particle staggers about at random until it touches the cluster, then freezes forever. Repeat a hundred thousand times and you have grown frost.',
  text:`Take a single seed. Release a particle far away and let it stagger — pure Brownian motion, no preference, no memory. When it happens to touch the seed, it sticks there forever. Release another. Repeat.<br><br>Every individual step is random. The object that results is not. It is a <b>fractal of dimension ≈1.71</b>, and its shape is one of the most widely reproduced in nature: manganese dendrites in limestone, electrodeposited copper, viscous fingering, lichen, retinal vasculature, the branching of a lung, and the frost that grows on a cold window overnight.<br><br>Why does it branch instead of filling in? Because a wandering particle is overwhelmingly likely to bump into a <em>tip</em> before it can find its way down into a fjord. The tips shield the interior — they are simply first. Growth amplifies its own advantage until the object screens itself into filigree. Physicists call it the <em>Laplacian instability</em>; a gardener would say the outside gets the light.<br><br>Colour records distance from the seed, so you are reading the cluster's history outward from its middle.`,
  code:`seed the cluster at a point.

repeat:
    release a walker on a circle just outside the cluster
    loop:
        walker takes a random unit step
        if it is now adjacent to the cluster:
            with probability p, stick → break
        if it has wandered too far away:
            abandon it, release another

fractal dimension of the result:  D ≈ 1.71
(a solid disc would be 2.00; a line, 1.00)

lowering p lets walkers probe deeper before
sticking — the cluster grows fatter and denser.`,
  hint:'Click or drag to plant seeds anywhere — they compete with the main cluster for the same wandering particles. Press R for a fresh dish.',
  ref:'<b>Witten, T. A. & Sander, L. M.</b> (1981) Diffusion-limited aggregation, a kinetic critical phenomenon. <i>Phys. Rev. Lett.</i> 47(19).',
  gl:false,
  prewarm:40,
  params:[
    {k:'seed',   label:'Seed', options:['Single point','Frost line','Ring, growing inward'], val:0},
    {k:'stick',  label:'Stickiness p', min:0.03, max:1, step:0.01, val:1, fmt:v=>v.toFixed(2)},
    {k:'budget', label:'Walker steps / frame', min:20000, max:400000, step:10000, val:90000,
                 fmt:v=>(v/1000).toFixed(0)+'k'},
    {k:'drift',  label:'Drift', min:0, max:0.9, step:0.02, val:0, fmt:v=>v.toFixed(2)},
    {k:'palette',label:'Palette', options:RAMP_NAMES, val:0}
  ],

  create(canvas, opts = {}){
    const preview = !!opts.preview;
    const ctx = canvas.getContext('2d', {alpha:false});
    const dpr = opts.dpr || 1;

    const P = {seed:0, stick:1, budget: preview ? 22000 : 90000, drift:0, palette:0};
    if (opts.params) Object.assign(P, opts.params);

    const GW = preview ? 220 : 640;
    let GH = 1;
    let stuck, off, offCtx, img, buf, cx, cy, maxR, stuckCount;
    let recent = [], done = false, idle = 0, dirty = true;

    const DX = [1,-1,0,0,1,1,-1,-1], DY = [0,0,1,-1,1,-1,1,-1];

    function put(x, y){
      if (x < 0 || y < 0 || x >= GW || y >= GH) return;
      const i = y * GW + x;
      if (stuck[i]) return;
      stuck[i] = 1; stuckCount++; dirty = true;
      const age = Math.min(1, Math.hypot(x - cx, y - cy) / (Math.min(GW, GH) * 0.5));
      const c = shade(RAMPS[RAMP_NAMES[Math.round(P.palette)]], age);
      buf[i] = ((255 << 24) | ((c[2]|0) << 16) | ((c[1]|0) << 8) | (c[0]|0)) >>> 0;
      if (Math.round(P.seed) === 0){
        const d = Math.hypot(x - cx, y - cy);
        if (d > maxR) maxR = d;
      }
      if (recent.length < 1800) recent.push(x, y);
    }

    function build(){
      GH = Math.max(40, Math.round(GW * (canvas.height / Math.max(1, canvas.width))));
      stuck = new Uint8Array(GW * GH);
      off = document.createElement('canvas'); off.width = GW; off.height = GH;
      offCtx = off.getContext('2d');
      img = offCtx.createImageData(GW, GH);
      buf = new Uint32Array(img.data.buffer);
      buf.fill(((255 << 24) | (14 << 16) | (11 << 8) | 10) >>> 0);   // ABGR ink
      cx = GW >> 1; cy = GH >> 1; maxR = 2; stuckCount = 0; recent = [];
      done = false; idle = 0; dirty = true;

      const mode = Math.round(P.seed);
      if (mode === 0){
        put(cx, cy);
      } else if (mode === 1){
        for (let x = 0; x < GW; x++) put(x, GH - 1);
        maxR = GH;
      } else {
        const r = Math.min(GW, GH) * 0.47;
        for (let a = 0; a < 6.2832; a += 0.0016)
          put(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r));
        maxR = r;
      }
      offCtx.putImageData(img, 0, 0);
    }
    build();

    function touching(x, y){
      for (let k = 0; k < 8; k++){
        const nx = x + DX[k], ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) continue;
        if (stuck[ny * GW + nx]) return true;
      }
      return false;
    }

    function step(){
      const W = canvas.width, H = canvas.height;
      const wantGH = Math.max(40, Math.round(GW * (H / Math.max(1, W))));
      if (Math.abs(wantGH - GH) > GH * 0.06) build();

      let budget = Math.round(P.budget);
      const mode = Math.round(P.seed);
      const stickP = P.stick, drift = P.drift;
      recent.length = 0;

      // The specimen is finished only when growth actually STALLS — never
      // because of where the material happens to sit. Testing the bounding
      // radius instead used to mean that planting a seed near the rim looked
      // identical to the cluster reaching the wall, so a visitor's click was
      // read as "done" and the dish was thrown away and regrown. It isn't,
      // and it isn't. Nothing here erases itself while you are watching.
      if (done) budget = 0;
      const before = stuckCount;
      const maxDim  = Math.max(GW, GH) * 0.95;
      const dishR   = Math.min(GW, GH) * 0.48;   // biggest ring that still fits
      let x = 0, y = 0, alive = false, guard = 0, misses = 0;
      let killR2 = 0, safe2 = 0;

      while (budget > 0 && guard++ < 6e6){
        if (!alive){
          if (mode === 0){
            // Recompute the launch circle for EVERY walker. Doing it once per
            // frame quantises the cluster into one shell per frame — a bullseye
            // — because maxR keeps growing while the spawn radius does not.
            const spawnR = maxR + 6;
            if (spawnR <= dishR){
              // Normal case: release on a ring just outside everything that is
              // stuck. Recomputed per walker — doing it per frame is what once
              // quantised the cluster into one shell per frame (a bullseye).
              safe2 = (maxR + 4) * (maxR + 4);
              killR2 = Math.min(maxDim, spawnR * 2.2 + 20) ** 2;
              const ang = Math.random() * 6.2832;
              x = Math.round(cx + Math.cos(ang) * spawnR);
              y = Math.round(cy + Math.sin(ang) * spawnR);
            } else {
              // A seed planted near the rim pushes the bounding circle outside
              // the dish, and a ring that big only has launch points hugging
              // the walls — walkers escape before they diffuse anywhere, and
              // growth dies. Release them from anywhere still empty instead.
              // Any empty cell is a legitimate starting point, it keeps every
              // seed in play, and it is what makes a planted seed actually
              // compete with the main cluster instead of being ignored.
              safe2 = Infinity;              // no long jump: nothing is far away
              killR2 = Infinity;             // the plate edge does the killing
              x = (Math.random() * GW) | 0;
              y = (Math.random() * GH) | 0;
            }
          } else if (mode === 1){
            x = (Math.random() * GW) | 0; y = 0;
          } else {
            x = cx + ((Math.random() * 9) | 0) - 4;
            y = cy + ((Math.random() * 9) | 0) - 4;
          }
          // When the dish finally fills, every launch point is occupied. Bail
          // out rather than spinning six million times looking for a free one.
          if (x < 0 || y < 0 || x >= GW || y >= GH || stuck[y * GW + x]){
            if (++misses > 800) break;
            continue;
          }
          misses = 0;
          alive = true;
        }

        if (mode === 0){
          const ddx = x - cx, ddy = y - cy;
          const d2 = ddx * ddx + ddy * ddy;        // squared — no sqrt in the hot loop
          if (d2 > killR2){ alive = false; continue; }
          if (d2 > safe2){
            // Outside the cluster's bounding circle nothing can be hit, so jump
            // straight back to just outside it rather than plodding cell by
            // cell. The landing radius stays above maxR, so this stays exact.
            const jump = (Math.sqrt(d2) - maxR - 2) | 0;
            if (jump > 1){
              const ang = Math.random() * 6.2832;
              x = Math.round(x + Math.cos(ang) * jump);
              y = Math.round(y + Math.sin(ang) * jump);
              budget--;
              if (x < 0 || y < 0 || x >= GW || y >= GH) alive = false;
              continue;
            }
          }
        }

        const k = (Math.random() * 4) | 0;
        x += DX[k]; y += DY[k];
        if (drift > 0 && Math.random() < drift) y++;
        budget--;

        if (x < 1 || y < 1 || x >= GW - 1 || y >= GH - 1){ alive = false; continue; }
        if (touching(x, y) && (stickP >= 1 || Math.random() < stickP)){
          put(x, y); alive = false;
        }
      }

      if (!done){
        // "Finished" means genuinely nothing is happening any more. After a
        // seed is planted far from the middle, walkers have a wide empty
        // annulus to cross and growth legitimately goes quiet for stretches —
        // calling that finished is how a visitor's click got thrown away.
        if (stuckCount === before){ if (++idle > 600) done = true; }
        else idle = 0;
      }

      // Nothing changed and nothing will: leave the canvas exactly as it is.
      if (done && !dirty) return;
      dirty = false;

      offCtx.putImageData(img, 0, 0);
      ctx.fillStyle = '#0a0b0e'; ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, 0, 0, W, H);

      if (!preview && recent.length){          // a faint spark on whatever just froze
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(180,220,255,0.20)';
        const sx = W / GW, sy = H / GH;
        for (let i = 0; i < recent.length; i += 2)
          ctx.fillRect(recent[i]*sx - sx, recent[i+1]*sy - sy, sx*3, sy*3);
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    return {
      step,
      set(k, v){
        const reseed = (k === 'seed' && Math.round(v) !== Math.round(P.seed));
        P[k] = v;
        if (reseed) build();
      },
      get(k){ return P[k]; },
      reset(){ build(); },
      resize(){ build(); },
      pointer(nx, ny, down){
        if (!down) return;
        const gx = Math.round(nx * GW), gy = Math.round(ny * GH);
        const r = 2;                                   // a seed you can actually see
        for (let dy = -r; dy <= r; dy++)
          for (let dx = -r; dx <= r; dx++)
            if (dx*dx + dy*dy <= r*r) put(gx + dx, gy + dy);
        // The long-jump assumes every stuck cell lies within maxR of the
        // centre, so a planted seed has to widen that bound or walkers would
        // tunnel straight past it.
        const d = Math.hypot(gx - cx, gy - cy) + r + 2;
        if (d > maxR) maxR = d;
        // Whatever the dish was doing, it is growing again now.
        done = false; idle = 0; dirty = true;
      },
      count(){ return stuckCount.toLocaleString() + ' particles frozen · ' + GW + '×' + GH + ' lattice'
                      + (done ? ' · specimen complete — press R to grow another' : ''); },
      destroy(){}
    };
  }
};
