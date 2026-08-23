/* ════════════════════════════════════════════════════════════════
   V · SYNC  —  Kuramoto oscillators / fireflies
   Nobody is keeping time. Everybody ends up keeping the same time.
   ════════════════════════════════════════════════════════════════ */

export default {
  id:'sync', num:'V', roman:'V',
  title:'Sync',
  subtitle:'Coupled phase oscillators',
  attr:'Winfree 1967 · Kuramoto 1975 · and the fireflies of the Mae Klong',
  accent:'#f0cd6d',
  desc:'Fireflies with different natural rhythms, each nudging only its neighbours. Above a critical coupling, a whole riverbank flashes as one.',
  text:`Along tidal rivers in Thailand and Malaysia, <em>Pteroptyx</em> fireflies gather in mangrove trees by the thousand and flash in unison — miles of riverbank pulsing together, for hours. Nineteenth-century naturalists reported it and were disbelieved; the effect was put down to the observer blinking.<br><br>There is no conductor. Each firefly has its own natural rhythm and one simple habit: when a neighbour flashes, shift your own timing slightly toward theirs. Kuramoto showed in 1975 that this is enough — and, remarkably, that it fails completely below a critical coupling strength and works almost completely above it. Synchrony arrives not gradually but as a <em>phase transition</em>, like water freezing.<br><br>The dial at the bottom is the <b>order parameter</b> — the length of the average of every oscillator's phase, as a vector on the unit circle. Zero is anarchy; one is a single organism. Drag the coupling slowly through the middle and watch where it snaps.`,
  code:`each oscillator i has a natural frequency ωᵢ
drawn from a spread around the mean.

  dθᵢ/dt  =  ωᵢ  +  (K / nᵢ) · Σ sin(θⱼ − θᵢ)
                              j ∈ neighbours(i)

it flashes when θ crosses 0.

order parameter:   r·e^{iψ} = (1/N) Σ e^{iθⱼ}

Kuramoto's result: for all-to-all coupling there is a
critical Kc below which r = 0 and above which r > 0.
Synchrony is a phase transition, not a gradient.`,
  hint:'Click to shock a patch of the swarm out of step, and watch it get pulled back in.',
  ref:'<b>Kuramoto, Y.</b> (1975) Self-entrainment of a population of coupled non-linear oscillators. · <b>Strogatz, S.</b> (2003) <i>Sync</i>.',
  gl:false,
  params:[
    {k:'K',      label:'Coupling K',     min:0, max:14, step:0.05, val:3.6, fmt:v=>v.toFixed(2)},
    {k:'spread', label:'Frequency spread', min:0, max:2.2, step:0.02, val:0.62, fmt:v=>v.toFixed(2)},
    {k:'radius', label:'Hearing distance', min:20, max:400, step:5, val:110, unit:'px'},
    {k:'count',  label:'Population',     min:80, max:1600, step:20, val:620},
    {k:'rate',   label:'Base tempo',     min:0.2, max:4, step:0.05, val:1.5, fmt:v=>v.toFixed(2)},
    {k:'sharp',  label:'Flash sharpness',min:4, max:60, step:1, val:22}
  ],

  create(canvas, opts = {}){
    const preview = !!opts.preview;
    const ctx = canvas.getContext('2d', {alpha:false});
    const dpr = opts.dpr || 1;

    const P = {K:3.6, spread:0.62, radius:110, count: preview ? 240 : 620, rate:1.5, sharp:22};
    if (opts.params) Object.assign(P, opts.params);

    let N = 0, x, y, th, om, nb;
    let W = canvas.width, H = canvas.height;
    let cellHead = null, cellNext = null, cols = 0, rows = 0, cellSize = 0;
    let R = 0, PSI = 0;                       // order parameter and mean phase
    let history = new Float32Array(240); let hi = 0;

    function allocate(n){
      N = n;
      x = new Float32Array(n); y = new Float32Array(n);
      th = new Float32Array(n); om = new Float32Array(n);
      nb = new Float32Array(n); cellNext = new Int32Array(n);
      for (let i = 0; i < n; i++){
        x[i] = Math.random() * W; y[i] = Math.random() * H;
        th[i] = Math.random() * Math.PI * 2;
        // gaussian-ish natural frequencies (sum of uniforms)
        om[i] = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      }
      history.fill(0); hi = 0;
    }
    allocate(Math.round(P.count));

    function grid(r){
      cellSize = Math.max(10, r);
      cols = Math.max(1, Math.ceil(W / cellSize));
      rows = Math.max(1, Math.ceil(H / cellSize));
      const need = cols * rows;
      if (!cellHead || cellHead.length !== need) cellHead = new Int32Array(need);
      cellHead.fill(-1);
      for (let i = 0; i < N; i++){
        let cx = (x[i]/cellSize)|0, cy = (y[i]/cellSize)|0;
        cx = cx < 0 ? 0 : cx >= cols ? cols-1 : cx;
        cy = cy < 0 ? 0 : cy >= rows ? rows-1 : cy;
        const c = cy*cols + cx;
        cellNext[i] = cellHead[c]; cellHead[c] = i;
      }
    }

    const TAU = Math.PI * 2;

    function step(dt){
      if (canvas.width !== W || canvas.height !== H){ W = canvas.width; H = canvas.height; }
      dt = Math.min(dt, 1/24);
      const r = P.radius * dpr, r2 = r*r;
      grid(r);

      // ── couple ──
      for (let i = 0; i < N; i++){
        let s = 0, cnt = 0;
        const ix = (x[i]/cellSize)|0, iy = (y[i]/cellSize)|0;
        for (let gy = iy-1; gy <= iy+1; gy++){
          if (gy < 0 || gy >= rows) continue;
          for (let gx = ix-1; gx <= ix+1; gx++){
            if (gx < 0 || gx >= cols) continue;
            for (let j = cellHead[gy*cols+gx]; j !== -1; j = cellNext[j]){
              if (j === i) continue;
              const dx = x[j]-x[i], dy = y[j]-y[i];
              if (dx*dx + dy*dy > r2) continue;
              s += Math.sin(th[j] - th[i]); cnt++;
            }
          }
        }
        nb[i] = cnt ? (P.K / cnt) * s : 0;
      }

      // ── advance, and measure how together they are ──
      let sc = 0, ss = 0;
      for (let i = 0; i < N; i++){
        th[i] += (P.rate * TAU * (1 + om[i] * P.spread) + nb[i]) * dt;
        if (th[i] > TAU) th[i] -= TAU; else if (th[i] < 0) th[i] += TAU;
        sc += Math.cos(th[i]); ss += Math.sin(th[i]);
      }
      sc /= N; ss /= N;
      R = Math.hypot(sc, ss); PSI = Math.atan2(ss, sc);
      history[hi] = R; hi = (hi + 1) % history.length;

      /* ── draw ── */
      ctx.fillStyle = '#06070a'; ctx.fillRect(0, 0, W, H);
      const sharp = P.sharp;
      const base = Math.max(1.6, 2.0 * dpr);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < N; i++){
        const f = Math.pow(Math.max(0, Math.sin(th[i])), sharp);   // brief flash
        if (f < 0.004) {
          ctx.globalAlpha = 0.16;
          ctx.fillStyle = '#2a2f3c';
          ctx.beginPath(); ctx.arc(x[i], y[i], base*0.5, 0, TAU); ctx.fill();
          continue;
        }
        const rad = base * (1 + f * 5.5);
        const g = ctx.createRadialGradient(x[i], y[i], 0, x[i], y[i], rad * 3.4);
        g.addColorStop(0,   `rgba(255,244,206,${0.95*f})`);
        g.addColorStop(0.22,`rgba(246,206,110,${0.62*f})`);
        g.addColorStop(0.6, `rgba(180,132,48,${0.16*f})`);
        g.addColorStop(1,   'rgba(120,90,30,0)');
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x[i], y[i], rad*3.4, 0, TAU); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      if (!preview) drawDial();
    }

    function drawDial(){
      const m = 26 * dpr, rad = 46 * dpr;
      const cx = W - m - rad, cy = H - m - rad;
      ctx.save();
      ctx.lineWidth = Math.max(1, dpr);
      // the unit circle
      ctx.strokeStyle = 'rgba(233,229,221,0.16)';
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.stroke();
      // every phase as a tick on the rim
      ctx.strokeStyle = 'rgba(240,205,109,0.30)';
      ctx.beginPath();
      const s = Math.max(1, Math.floor(N / 400));
      for (let i = 0; i < N; i += s){
        const a = th[i];
        ctx.moveTo(cx + Math.cos(a)*rad*0.86, cy + Math.sin(a)*rad*0.86);
        ctx.lineTo(cx + Math.cos(a)*rad,      cy + Math.sin(a)*rad);
      }
      ctx.stroke();
      // the mean vector
      ctx.strokeStyle = '#f0cd6d'; ctx.lineWidth = Math.max(1.4, 1.8*dpr);
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(PSI)*rad*R, cy + Math.sin(PSI)*rad*R); ctx.stroke();
      ctx.fillStyle = '#f0cd6d';
      ctx.beginPath(); ctx.arc(cx + Math.cos(PSI)*rad*R, cy + Math.sin(PSI)*rad*R, 2.6*dpr, 0, TAU); ctx.fill();
      // the trace of r over the last few seconds
      ctx.strokeStyle = 'rgba(240,205,109,0.55)'; ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      const hw = 150*dpr, hh = 30*dpr, hx = cx - rad - 18*dpr - hw, hy = cy + rad - hh;
      for (let k = 0; k < history.length; k++){
        const v = history[(hi + k) % history.length];
        const X = hx + (k / (history.length-1)) * hw, Y = hy + hh - v*hh;
        k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke();
      ctx.strokeStyle = 'rgba(233,229,221,0.12)';
      ctx.beginPath(); ctx.moveTo(hx, hy+hh); ctx.lineTo(hx+hw, hy+hh); ctx.stroke();
      ctx.fillStyle = 'rgba(233,229,221,0.62)';
      ctx.font = `${9.5*dpr}px "IBM Plex Mono", monospace`;
      ctx.textAlign = 'right';
      ctx.fillText('ORDER  r = ' + R.toFixed(3), cx + rad, cy + rad + 16*dpr);
      ctx.restore();
    }

    return {
      step,
      set(k, v){
        if (k === 'count'){ const n = Math.round(v); if (n !== N) allocate(n); P.count = n; return; }
        P[k] = v;
      },
      get(k){ return P[k]; },
      reset(){ allocate(Math.round(P.count)); },
      resize(){ W = canvas.width; H = canvas.height; },
      pointer(nx, ny, down){
        if (!down) return;
        const cx = nx*W, cy = ny*H, rr = (170*dpr)**2;
        for (let i = 0; i < N; i++){
          const dx = x[i]-cx, dy = y[i]-cy;
          if (dx*dx + dy*dy < rr) th[i] = Math.random()*TAU;   // a shock to the system
        }
      },
      count(){ return N.toLocaleString() + ' oscillators · order r=' + R.toFixed(3); },
      destroy(){}
    };
  }
};
