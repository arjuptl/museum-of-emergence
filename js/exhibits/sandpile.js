/* ════════════════════════════════════════════════════════════════
   VI · AVALANCHE  —  the Abelian sandpile (Bak–Tang–Wiesenfeld, 1987)
   Add sand one grain at a time. The pile organises itself, without
   being tuned, onto the exact knife-edge between stable and unstable.
   ════════════════════════════════════════════════════════════════ */

const PALETTES = {
  'Gilt plate':   [[10,11,14],[44,53,80],[177,135,63],[236,217,168]],
  'Verdigris':    [[8,12,12],[26,64,60],[86,150,120],[214,236,206]],
  'Ash & ember':  [[10,9,9],[62,38,34],[168,72,40],[248,214,150]],
  'Blueprint':    [[6,9,16],[22,44,86],[62,110,180],[206,230,255]]
};
const PAL_NAMES = Object.keys(PALETTES);

export default {
  id:'sandpile', num:'VI', roman:'VI',
  title:'Avalanche',
  subtitle:'The Abelian sandpile · self-organised criticality',
  attr:'Bak, Tang & Wiesenfeld · 1987',
  accent:'#c79a4e',
  desc:'Drop sand one grain at a time. The pile tunes itself to the critical point, where one grain can move nothing — or everything.',
  text:`Most systems are only interesting when you tune them precisely: heat water to exactly 100°C and it does something dramatic; a degree either side and it does not. Bak, Tang and Wiesenfeld found a class of systems that <em>tune themselves</em> there and stay, without anyone adjusting a dial. They called it self-organised criticality, and their toy model was a sand pile.<br><br>The rule is trivial. A cell holding four or more grains topples, giving one grain to each of its four neighbours. Grains that fall off the table are lost. That's all.<br><br>The consequence is not trivial. Once the pile has filled up, the size of the avalanche caused by the next single grain has no typical value. Most do nothing. Some cross the whole plate. Plot how often each size occurs and you get a straight line on log-log paper — a <b>power law</b>, the signature of a system with no characteristic scale. The same distribution shows up in earthquakes, forest fires, neuronal cascades, extinction events and market crashes. The pile is measuring it for you at the bottom right.<br><br>And the pile itself, dropped always on one square, is not a heap at all. It is this: a deterministic fractal that nobody drew.`,
  code:`grid of integers. repeatedly:

    add 1 grain at the source cell

    while any cell z ≥ 4:
        z          −= 4
        z.north    += 1
        z.south    += 1
        z.east     += 1
        z.west     += 1
        (grains leaving the plate are lost)

    record how many topplings that took → avalanche size s

"Abelian": the final configuration does not depend
on the order in which you resolve the topplings.
The pile has one answer, and knows it.`,
  hint:'Click anywhere to drop a fistful of sand there. Switch to Random rain to build the power law.',
  ref:'<b>Bak, P., Tang, C. & Wiesenfeld, K.</b> (1987) Self-organized criticality: an explanation of 1/f noise. <i>Phys. Rev. Lett.</i> 59(4).',
  gl:false,
  prewarm:26,
  params:[
    {k:'mode',   label:'Source', options:['Single source','Random rain'], val:0},
    {k:'budget', label:'Topplings / frame', min:10000, max:900000, step:10000, val:140000,
                 fmt:v=>(v/1000).toFixed(0)+'k'},
    {k:'palette',label:'Palette', options:PAL_NAMES, val:0},
    {k:'heat',   label:'Show the avalanche', min:0, max:1, step:0.02, val:0.66, fmt:v=>v.toFixed(2)}
  ],

  create(canvas, opts = {}){
    const preview = !!opts.preview;
    const ctx = canvas.getContext('2d', {alpha:false});
    const dpr = opts.dpr || 1;
    ctx.imageSmoothingEnabled = false;

    const P = {mode:0, budget: preview ? 30000 : 140000, palette:0, heat:0.66};
    if (opts.params) Object.assign(P, opts.params);

    const G = preview ? 161 : 501;          // odd, so there is a true centre
    let cell, heat, stack, buf, off, offCtx, img;
    let grains = 0, biggest = 0, avalanches = 0;
    const flat = new Uint32Array(4);
    let flatFor = -1;
    function buildFlat(pi){
      const pal = PALETTES[PAL_NAMES[pi]];
      for (let v = 0; v < 4; v++)
        flat[v] = ((255 << 24) | (pal[v][2] << 16) | (pal[v][1] << 8) | pal[v][0]) >>> 0;
    }
    const BINS = 26;                         // log2 bins of avalanche size
    let hist = new Float64Array(BINS);
    let drop = null;

    function init(){
      cell  = new Int32Array(G*G);
      heat  = new Float32Array(G*G);
      stack = new Int32Array(G*G*2);
      off   = document.createElement('canvas'); off.width = G; off.height = G;
      offCtx = off.getContext('2d');
      img   = offCtx.createImageData(G, G);
      buf   = new Uint32Array(img.data.buffer);
      grains = 0; biggest = 0; avalanches = 0; hist = new Float64Array(BINS);
    }
    init();

    /* one grain at (cx,cy); resolve fully; return topplings used */
    function addGrain(cx, cy){
      let sp = 0, work = 0;
      cell[cy*G + cx]++;
      if (cell[cy*G + cx] >= 4) stack[sp++] = cy*G + cx;
      while (sp > 0){
        const idx = stack[--sp];
        if (cell[idx] < 4) continue;
        const n = (cell[idx] / 4) | 0;
        cell[idx] -= n*4;
        work += n;
        heat[idx] = Math.min(3, heat[idx] + n*0.55);
        const x = idx % G, y = (idx / G) | 0;
        if (x > 0)   { const k = idx-1; cell[k] += n; if (cell[k] >= 4 && sp < stack.length) stack[sp++] = k; }
        if (x < G-1) { const k = idx+1; cell[k] += n; if (cell[k] >= 4 && sp < stack.length) stack[sp++] = k; }
        if (y > 0)   { const k = idx-G; cell[k] += n; if (cell[k] >= 4 && sp < stack.length) stack[sp++] = k; }
        if (y < G-1) { const k = idx+G; cell[k] += n; if (cell[k] >= 4 && sp < stack.length) stack[sp++] = k; }
        // grains at the rim simply fall off the plate
      }
      return work;
    }

    function record(s){
      if (s <= 0) return;
      avalanches++;
      if (s > biggest) biggest = s;
      const b = Math.min(BINS-1, Math.floor(Math.log2(s)));
      hist[b]++;
    }

    function step(){
      const W = canvas.width, H = canvas.height;
      let budget = Math.round(P.budget);
      const c = (G/2)|0;

      if (drop){                                    // a visitor's fistful
        const n = preview ? 200 : 2000;
        for (let i = 0; i < n; i++) budget -= addGrain(drop[0], drop[1]);
        drop = null;
      }

      let guard = 0;
      while (budget > 0 && guard++ < 60000){
        let sx = c, sy = c;
        if (P.mode >= 0.5){ sx = (Math.random()*G)|0; sy = (Math.random()*G)|0; }
        const used = addGrain(sx, sy);
        grains++;
        record(used);
        budget -= Math.max(used, 1);
      }

      /* ── paint ── */
      const pi = Math.round(P.palette);
      if (pi !== flatFor){ buildFlat(pi); flatFor = pi; }
      const hk = P.heat;
      for (let i = 0, n = G*G; i < n; i++){
        const v = cell[i] > 3 ? 3 : cell[i];
        const h0 = heat[i];
        if (hk > 0 && h0 > 0.002){                       // rare: only cells mid-avalanche
          const pal = PALETTES[PAL_NAMES[pi]];
          const h = (h0 < 1 ? h0 : 1) * hk;
          const r = pal[v][0] + (255 - pal[v][0]) * h * 0.85;
          const g = pal[v][1] + (238 - pal[v][1]) * h * 0.70;
          const b = pal[v][2] + (196 - pal[v][2]) * h * 0.42;
          heat[i] = h0 * 0.86;
          buf[i] = (255 << 24) | ((b|0) << 16) | ((g|0) << 8) | (r|0);
        } else {
          if (h0 !== 0) heat[i] = 0;
          buf[i] = flat[v];                              // common case: one lookup
        }
      }
      offCtx.putImageData(img, 0, 0);

      ctx.fillStyle = '#06070a'; ctx.fillRect(0, 0, W, H);
      const side = Math.min(W, H) * (preview ? 1.0 : 0.94);
      const ox = (W - side)/2, oy = (H - side)/2;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(off, ox, oy, side, side);
      if (!preview){
        ctx.strokeStyle = 'rgba(233,229,221,0.14)';
        ctx.lineWidth = Math.max(1, dpr);
        ctx.strokeRect(ox+0.5, oy+0.5, side-1, side-1);
        drawHistogram(W, H);
      }
    }

    function drawHistogram(W, H){
      if (avalanches < 40) return;
      const w = 168*dpr, h = 86*dpr, x0 = W - w - 26*dpr, y0 = H - h - 34*dpr;
      let max = 0;
      for (let i = 0; i < BINS; i++) if (hist[i] > max) max = hist[i];
      if (max <= 0) return;
      ctx.save();
      ctx.fillStyle = 'rgba(6,7,10,0.62)';
      ctx.fillRect(x0 - 8*dpr, y0 - 10*dpr, w + 16*dpr, h + 34*dpr);
      ctx.strokeStyle = 'rgba(233,229,221,0.10)'; ctx.lineWidth = Math.max(1,dpr);
      ctx.strokeRect(x0 - 8*dpr, y0 - 10*dpr, w + 16*dpr, h + 34*dpr);
      // log-log bars
      const lmax = Math.log10(max + 1);
      ctx.fillStyle = 'rgba(199,154,78,0.80)';
      const bw = w / BINS;
      for (let i = 0; i < BINS; i++){
        if (!hist[i]) continue;
        const v = Math.log10(hist[i] + 1) / lmax;
        ctx.fillRect(x0 + i*bw, y0 + h - v*h, Math.max(1, bw - 1*dpr), v*h);
      }
      // reference slope
      ctx.strokeStyle = 'rgba(233,229,221,0.34)';
      ctx.setLineDash([3*dpr, 3*dpr]);
      ctx.beginPath(); ctx.moveTo(x0, y0 + h*0.06); ctx.lineTo(x0 + w, y0 + h*0.92); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(233,229,221,0.66)';
      ctx.font = `${9*dpr}px "IBM Plex Mono", monospace`;
      ctx.fillText('P(s) vs s   log–log', x0, y0 - 1*dpr);
      ctx.fillText('largest ' + biggest.toLocaleString() + ' topplings', x0, y0 + h + 14*dpr);
      ctx.restore();
    }

    return {
      step,
      set(k, v){ P[k] = v; },
      get(k){ return P[k]; },
      reset(){ init(); },
      resize(){},
      pointer(x, y, down){
        if (!down) return;
        const W = canvas.width, H = canvas.height;
        const side = Math.min(W, H) * (preview ? 1.0 : 0.94);
        const ox = (W - side)/2, oy = (H - side)/2;
        const gx = Math.floor((x*W - ox) / side * G), gy = Math.floor((y*H - oy) / side * G);
        if (gx >= 0 && gx < G && gy >= 0 && gy < G) drop = [gx, gy];
      },
      count(){ return grains.toLocaleString() + ' grains · ' + G + '×' + G + ' plate · largest avalanche ' + biggest.toLocaleString(); },
      destroy(){}
    };
  }
};
