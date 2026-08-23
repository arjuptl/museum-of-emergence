/* ════════════════════════════════════════════════════════════════
   VIII · RULE 30  —  elementary cellular automata (Wolfram, 1983)
   The smallest interesting program in the world. One line of cells,
   eight instructions, and a source of randomness good enough that
   Mathematica shipped it as one.
   ════════════════════════════════════════════════════════════════ */

const NOTABLE = [
  {n:30,  why:'chaos from one cell'},
  {n:110, why:'Turing complete'},
  {n:90,  why:'Sierpiński triangle'},
  {n:150, why:'nested, self-similar'},
  {n:54,  why:'gliders on a lattice'},
  {n:22,  why:'fractal, sparse'},
  {n:73,  why:'walled compartments'},
  {n:105, why:'restless order'},
  {n:45,  why:'chaotic, biased'},
  {n:126, why:'Sierpiński, inverted'}
];

export default {
  id:'rule30', num:'VIII', roman:'VIII',
  title:'Rule 30',
  subtitle:'Elementary cellular automata',
  attr:'Stephen Wolfram · 1983',
  accent:'#e6ded0',
  desc:'One row of cells. Eight instructions, expressible in eight bits. From a single black square: randomness no statistical test can distinguish from noise.',
  text:`This is very nearly the simplest program that can exist. A row of cells, each black or white. To make the next row, look at each cell together with its two neighbours — three cells, so eight possible situations — and consult a table that says black or white for each. The table is eight bits, so there are exactly 256 possible universes. Wolfram numbered them.<br><br>Most are boring: they die, or fill in, or repeat. A handful are not. <b>Rule 90</b> draws the Sierpiński triangle. <b>Rule 110</b> was proved in 2004 to be <em>Turing complete</em> — that row of cells can, in principle, run any computation that any computer can run.<br><br>And <b>Rule 30</b>, started from a single black cell, produces a left side that is orderly and a right side that is — as far as anyone has been able to prove in forty years — genuinely, irreducibly chaotic. The centre column passes every practical test for randomness. Mathematica used it as its random number generator. There is a standing prize, still unclaimed, for showing that column is aperiodic.<br><br>The point is not that the output is complicated. It is that <em>there is no shortcut to it</em>. To know row one million you must compute row one million. Wolfram calls this computational irreducibility, and if it is as common as he thinks, it is the reason so much of the world has to be lived rather than predicted.`,
  code:`state: one row of cells, each 0 or 1.

new cell = TABLE[ left·4 + centre·2 + right ]

where TABLE is the 8 bits of the rule number.

Rule 30 = 00011110₂ , so:

   111→0   110→0   101→0   100→1
   011→1   010→1   001→1   000→0

start from a single 1 in an ocean of 0s
and run it downward. Forever.`,
  hint:'Type any rule from 0 to 255. Most are dull. Some are universes.',
  ref:'<b>Wolfram, S.</b> (1983) Statistical mechanics of cellular automata. <i>Rev. Mod. Phys.</i> 55. · <b>Cook, M.</b> (2004) Universality in elementary cellular automata.',
  gl:false,
  params:[
    {k:'preset', label:'Notable rules', options:NOTABLE.map(r=>r.n + ' — ' + r.why), val:0, onSet:true},
    {k:'rule',  label:'Rule number', min:0, max:255, step:1, val:30},
    {k:'scale', label:'Cell size', min:1, max:8, step:1, val:2, unit:'px'},
    {k:'rows',  label:'Rows / frame', min:1, max:12, step:1, val:2},
    {k:'start', label:'Initial row', options:['A single cell','Random noise'], val:0, reseed:true}
  ],

  create(canvas, opts = {}){
    const preview = !!opts.preview;
    const ctx = canvas.getContext('2d', {alpha:false});
    const dpr = opts.dpr || 1;

    const P = {preset:0, rule:30, scale: preview ? 1 : 2, rows: preview ? 3 : 2, start:0};
    if (opts.params) Object.assign(P, opts.params);

    let GW, GH, cur, nxt, off, offCtx, rowImg, rowBuf, head, generation, table;
    let lastScale = -1;

    function bits(rule){
      const t = new Uint8Array(8);
      for (let i = 0; i < 8; i++) t[i] = (rule >> i) & 1;
      return t;
    }

    function build(){
      const px = Math.max(1, Math.round(P.scale) * dpr);
      GW = Math.max(16, Math.ceil(canvas.width  / px));
      GH = Math.max(16, Math.ceil(canvas.height / px));
      cur = new Uint8Array(GW); nxt = new Uint8Array(GW);
      off = document.createElement('canvas'); off.width = GW; off.height = GH;
      offCtx = off.getContext('2d');
      offCtx.fillStyle = '#080a0c'; offCtx.fillRect(0, 0, GW, GH);
      rowImg = offCtx.createImageData(GW, 1);
      rowBuf = new Uint32Array(rowImg.data.buffer);
      head = 0; generation = 0;
      lastScale = px;
      if (Math.round(P.start) === 0) cur[GW >> 1] = 1;
      else for (let i = 0; i < GW; i++) cur[i] = Math.random() < 0.5 ? 1 : 0;
      table = bits(Math.round(P.rule));
      blitRow();
    }

    const ON  = ((255<<24) | (208<<16) | (222<<8) | 232) >>> 0;   // ABGR: warm paper
    const OFF = ((255<<24) | (12<<16)  | (10<<8)  | 8)   >>> 0;

    function blitRow(){
      for (let i = 0; i < GW; i++) rowBuf[i] = cur[i] ? ON : OFF;
      offCtx.putImageData(rowImg, 0, head);
      head = (head + 1) % GH;
    }

    function advance(){
      for (let i = 0; i < GW; i++){
        const l = cur[i === 0 ? GW-1 : i-1];
        const c = cur[i];
        const r = cur[i === GW-1 ? 0 : i+1];
        nxt[i] = table[(l<<2) | (c<<1) | r];
      }
      const t = cur; cur = nxt; nxt = t;
      generation++;
      blitRow();
    }

    build();

    function step(){
      const W = canvas.width, H = canvas.height;
      const px = Math.max(1, Math.round(P.scale) * dpr);
      if (px !== lastScale || GW !== Math.max(16, Math.ceil(W/px)) ||
          GH !== Math.max(16, Math.ceil(H/px))) build();

      const n = Math.round(P.rows);
      for (let i = 0; i < n; i++) advance();

      ctx.fillStyle = '#080a0c'; ctx.fillRect(0, 0, W, H);
      ctx.imageSmoothingEnabled = false;
      // unroll the ring buffer: the row after `head` is the oldest
      const below = GH - head;
      ctx.drawImage(off, 0, head, GW, below,  0, 0,           W, below*px);
      if (head > 0) ctx.drawImage(off, 0, 0, GW, head, 0, below*px, W, head*px);

      if (!preview) drawLegend(W, H);
    }

    function drawLegend(W, H){
      const s = 7*dpr, gap = 4*dpr;
      const cellW = s*3 + gap*3;
      const bw = cellW*8 + 18*dpr, bh = s*2 + 30*dpr;
      const x0 = 22*dpr, y0 = H - bh - 22*dpr;
      ctx.save();
      ctx.fillStyle = 'rgba(6,7,10,0.72)';
      ctx.fillRect(x0 - 10*dpr, y0 - 8*dpr, bw, bh);
      ctx.strokeStyle = 'rgba(233,229,221,0.10)'; ctx.lineWidth = Math.max(1,dpr);
      ctx.strokeRect(x0 - 10*dpr, y0 - 8*dpr, bw, bh);
      ctx.fillStyle = 'rgba(233,229,221,0.55)';
      ctx.font = `${9*dpr}px "IBM Plex Mono", monospace`;
      ctx.fillText('RULE ' + Math.round(P.rule) + '  =  ' +
        Math.round(P.rule).toString(2).padStart(8,'0') + '₂   ·   generation ' +
        generation.toLocaleString(), x0 - 4*dpr, y0 + bh - 16*dpr);
      for (let i = 7; i >= 0; i--){
        const col = (7 - i) * cellW + x0;
        for (let b = 0; b < 3; b++){
          const on = (i >> (2-b)) & 1;
          ctx.fillStyle = on ? '#e8ded0' : '#1a1d22';
          ctx.fillRect(col + b*s, y0, s-1*dpr, s-1*dpr);
        }
        ctx.fillStyle = table[i] ? '#e8ded0' : '#1a1d22';
        ctx.fillRect(col + s, y0 + s + 2*dpr, s-1*dpr, s-1*dpr);
      }
      ctx.restore();
    }

    return {
      step,
      set(k, v){
        if (k === 'preset'){
          P.preset = v;
          const rule = NOTABLE[Math.round(v)].n;
          P.rule = rule; table = bits(rule);
          return {rule};
        }
        const reseed = (k === 'start' && Math.round(v) !== Math.round(P.start));
        P[k] = v;
        if (k === 'rule') table = bits(Math.round(v));
        if (reseed || k === 'scale') build();
      },
      get(k){ return P[k]; },
      reset(){ build(); },
      resize(){ build(); },
      pointer(){},
      count(){ return 'rule ' + Math.round(P.rule) + ' · ' + GW + ' cells · generation ' + generation.toLocaleString(); },
      destroy(){}
    };
  }
};
