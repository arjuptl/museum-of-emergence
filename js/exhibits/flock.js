/* ════════════════════════════════════════════════════════════════
   I · FLOCK  —  Boids (Reynolds, 1986)
   Three rules, each of which a bird could plausibly execute
   with one eye and no memory. Nothing computes the flock.
   ════════════════════════════════════════════════════════════════ */

export default {
  id:'flock', num:'I', roman:'I',
  title:'Flock',
  subtitle:'Boids',
  attr:'Craig Reynolds · 1986',
  accent:'#d8b4d8',
  desc:'Separation, alignment, cohesion. Three rules with a radius of a few body-lengths, and a murmuration turns as one animal.',
  text:`Craig Reynolds was trying to animate a bat swarm for a film and found the problem impossible from the top down: you cannot choreograph a thousand things. So he stopped trying, and gave each thing three rules instead.<br><br><b>Separation</b> — don't crowd your neighbours. <b>Alignment</b> — steer the way they're steering. <b>Cohesion</b> — drift toward where they are. Each boid can see only a small disc around itself. There is no leader, no plan, and nowhere in the program is the word <em>flock</em>.<br><br>What Reynolds discovered is that the interesting behaviour is not in the rules but in their <em>ratio</em>. Weight separation too heavily and the flock explodes into a gas. Weight cohesion too heavily and it collapses to a knot. The living, breathing, splitting-and-rejoining murmuration exists only in a narrow band between the two — and biologists have since found real starlings sitting almost exactly in it, tracking roughly seven neighbours regardless of how dense the flock gets.`,
  code:`for each boid b, once per frame:

  neighbours = all boids within radius r of b

  separation = Σ (b.pos − n.pos)/‖d‖²    for very close n
  alignment  = mean(n.vel) − b.vel
  cohesion   = mean(n.pos) − b.pos

  accel = wₛ·separation + wₐ·alignment + w꜀·cohesion
  vel  += accel          (clamped to a max speed)
  pos  += vel

That is the entire program. Written in 1986.
No boid ever knows how many boids there are.`,
  hint:'Move the pointer to herd them. Hold ⇧ Shift and they scatter like a hawk arrived.',
  ref:'<b>Reynolds, C. W.</b> (1987) Flocks, herds and schools: a distributed behavioral model. <i>SIGGRAPH \'87</i>.',
  gl:false,
  params:[
    {k:'sep',    label:'Separation', min:0, max:4,   step:0.02, val:1.55, fmt:v=>v.toFixed(2)},
    {k:'ali',    label:'Alignment',  min:0, max:3,   step:0.02, val:1.05, fmt:v=>v.toFixed(2)},
    {k:'coh',    label:'Cohesion',   min:0, max:3,   step:0.02, val:0.85, fmt:v=>v.toFixed(2)},
    {k:'radius', label:'Field of view', min:10, max:90, step:1, val:38, unit:'px'},
    {k:'speed',  label:'Max speed',  min:0.5, max:6, step:0.1,  val:2.7, fmt:v=>v.toFixed(1)},
    {k:'count',  label:'Population', min:100, max:2200, step:20, val:900},
    {k:'trail',  label:'Persistence of vision', min:0.02, max:0.55, step:0.01, val:0.13, fmt:v=>v.toFixed(2)}
  ],

  create(canvas, opts = {}){
    const preview = !!opts.preview;
    const ctx = canvas.getContext('2d', {alpha:false});
    const dpr = opts.dpr || 1;

    const P = {sep:1.55, ali:1.05, coh:0.85, radius:38, speed:2.7,
               count: preview ? 260 : 900, trail:0.13};
    if (opts.params) Object.assign(P, opts.params);

    let N = 0, px, py, vx, vy, ax, ay, hue;
    let W = canvas.width, H = canvas.height;
    let ptr = {x:-1e5, y:-1e5, on:false, rep:false};
    let cells = null, cellHead = null, cellNext = null, cols = 0, rows = 0, cellSize = 0;

    function allocate(n){
      N = n;
      px = new Float32Array(n); py = new Float32Array(n);
      vx = new Float32Array(n); vy = new Float32Array(n);
      ax = new Float32Array(n); ay = new Float32Array(n);
      hue = new Float32Array(n);
      cellNext = new Int32Array(n);
      for (let i = 0; i < n; i++){
        px[i] = Math.random() * W; py[i] = Math.random() * H;
        const a = Math.random() * Math.PI * 2, s = 1 + Math.random();
        vx[i] = Math.cos(a) * s; vy[i] = Math.sin(a) * s;
        hue[i] = Math.random();
      }
    }

    function clearScreen(){
      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, W, H);
    }

    allocate(Math.round(P.count));
    clearScreen();

    function rebuildGrid(r){
      cellSize = Math.max(8, r);
      cols = Math.max(1, Math.ceil(W / cellSize));
      rows = Math.max(1, Math.ceil(H / cellSize));
      const need = cols * rows;
      if (!cellHead || cellHead.length !== need) cellHead = new Int32Array(need);
      cellHead.fill(-1);
      for (let i = 0; i < N; i++){
        let cx = (px[i] / cellSize) | 0, cy = (py[i] / cellSize) | 0;
        if (cx < 0) cx = 0; else if (cx >= cols) cx = cols - 1;
        if (cy < 0) cy = 0; else if (cy >= rows) cy = rows - 1;
        const c = cy * cols + cx;
        cellNext[i] = cellHead[c]; cellHead[c] = i;
      }
    }

    function step(dt){
      if (canvas.width !== W || canvas.height !== H){
        W = canvas.width; H = canvas.height; clearScreen();
      }
      const scale = dpr;
      const r  = P.radius * scale;
      const r2 = r * r;
      const sepR = r * 0.42, sepR2 = sepR * sepR;
      const maxS = P.speed * scale;
      const maxF = 0.09 * scale;

      rebuildGrid(r);

      for (let i = 0; i < N; i++){
        let sx = 0, sy = 0, alx = 0, aly = 0, cx = 0, cy = 0, cnt = 0, scnt = 0;
        const ix = (px[i] / cellSize) | 0, iy = (py[i] / cellSize) | 0;

        for (let gy = iy - 1; gy <= iy + 1; gy++){
          if (gy < 0 || gy >= rows) continue;
          for (let gx = ix - 1; gx <= ix + 1; gx++){
            if (gx < 0 || gx >= cols) continue;
            for (let j = cellHead[gy * cols + gx]; j !== -1; j = cellNext[j]){
              if (j === i) continue;
              const dx = px[j] - px[i], dy = py[j] - py[i];
              const d2 = dx*dx + dy*dy;
              if (d2 > r2 || d2 === 0) continue;
              cnt++;
              alx += vx[j]; aly += vy[j];
              cx  += px[j]; cy  += py[j];
              if (d2 < sepR2){ const inv = 1 / d2; sx -= dx * inv; sy -= dy * inv; scnt++; }
            }
          }
        }

        let fx = 0, fy = 0;
        if (scnt){
          const m = Math.hypot(sx, sy) || 1;
          fx += (sx / m * maxS - vx[i]) * P.sep;
          fy += (sy / m * maxS - vy[i]) * P.sep;
        }
        if (cnt){
          const m1 = Math.hypot(alx, aly) || 1;
          fx += (alx / m1 * maxS - vx[i]) * P.ali;
          fy += (aly / m1 * maxS - vy[i]) * P.ali;
          const ddx = cx / cnt - px[i], ddy = cy / cnt - py[i];
          const m2 = Math.hypot(ddx, ddy) || 1;
          fx += (ddx / m2 * maxS - vx[i]) * P.coh;
          fy += (ddy / m2 * maxS - vy[i]) * P.coh;
        }

        if (ptr.on){
          const dx = ptr.x - px[i], dy = ptr.y - py[i];
          const d = Math.hypot(dx, dy) || 1;
          if (d < 340 * scale){
            const g = (1 - d / (340 * scale)) * (ptr.rep ? -3.2 : 1.5);
            fx += dx / d * g; fy += dy / d * g;
          }
        }

        // soft walls: turn back before the edge rather than teleporting
        const m = 46 * scale;
        if (px[i] < m)     fx += (m - px[i]) * 0.006;
        if (px[i] > W - m) fx -= (px[i] - (W - m)) * 0.006;
        if (py[i] < m)     fy += (m - py[i]) * 0.006;
        if (py[i] > H - m) fy -= (py[i] - (H - m)) * 0.006;

        const fm = Math.hypot(fx, fy);
        if (fm > maxF){ fx = fx / fm * maxF; fy = fy / fm * maxF; }
        ax[i] = fx; ay[i] = fy;
      }

      const k = Math.min(2.4, dt * 60);
      for (let i = 0; i < N; i++){
        vx[i] += ax[i] * k; vy[i] += ay[i] * k;
        const s = Math.hypot(vx[i], vy[i]);
        if (s > maxS){ vx[i] = vx[i] / s * maxS; vy[i] = vy[i] / s * maxS; }
        else if (s < maxS * 0.3 && s > 0){ vx[i] = vx[i] / s * maxS * 0.3; vy[i] = vy[i] / s * maxS * 0.3; }
        px[i] += vx[i] * k; py[i] += vy[i] * k;
        if (px[i] < 0) px[i] = 0; else if (px[i] > W) px[i] = W;
        if (py[i] < 0) py[i] = 0; else if (py[i] > H) py[i] = H;
      }

      /* ── draw: streaks, not dots. speed sets the colour temperature ── */
      ctx.fillStyle = `rgba(6,7,10,${P.trail})`;
      ctx.fillRect(0, 0, W, H);
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(1, 1.15 * scale);
      const tail = 3.6;
      for (let i = 0; i < N; i++){
        const s = Math.hypot(vx[i], vy[i]) / maxS;
        const l = 46 + s * 34;
        const h = 268 + hue[i] * 62 - s * 26;
        ctx.strokeStyle = `hsl(${h} ${34 + s*30}% ${l}%)`;
        ctx.beginPath();
        ctx.moveTo(px[i], py[i]);
        ctx.lineTo(px[i] - vx[i] * tail, py[i] - vy[i] * tail);
        ctx.stroke();
      }
    }

    return {
      step,
      set(k, v){
        if (k === 'count'){
          const n = Math.round(v);
          if (n !== N) allocate(n);
          P.count = n; return;
        }
        P[k] = v;
      },
      get(k){ return P[k]; },
      reset(){ allocate(Math.round(P.count)); clearScreen(); },
      resize(){ W = canvas.width; H = canvas.height; clearScreen(); },
      pointer(x, y, down, shift){
        ptr.x = x * W; ptr.y = y * H; ptr.on = true; ptr.rep = !!shift;
        if (x < 0) ptr.on = false;
      },
      leave(){ ptr.on = false; },
      count(){ return N.toLocaleString() + ' boids · ' + (P.radius|0) + 'px field of view'; },
      destroy(){}
    };
  }
};
