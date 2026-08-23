/* ════════════════════════════════════════════════════════════════
   IV · LENIA  —  continuous cellular automata (Chan, 2019)
   Conway's Life with the corners filed off: real-valued states,
   a smooth ring-shaped neighbourhood, a smooth growth rule.
   What crawls out of it looks disconcertingly alive.
   ════════════════════════════════════════════════════════════════ */
import { getContext, program, VERT_QUAD, GLSL_LIB, PingPong, drawQuad, emptyVAO } from '../gl.js';

const F_STEP = R => `#version 300 es
precision highp float;
#define R ${R}
uniform sampler2D uField;
uniform vec2  uGrid;
uniform float uMu, uSigma, uT, uKmu, uKsigma;
uniform vec4  uBrush;
in vec2 uv;
out vec4 outColor;

float bell(float x, float m, float s){
  float d = (x - m) / s;
  return exp(-0.5 * d * d);
}

void main(){
  vec2 px = 1.0 / uGrid;
  float sum = 0.0, wsum = 0.0;
  float Rf = float(R);

  for (int y = -R; y <= R; y++){
    for (int x = -R; x <= R; x++){
      float r = length(vec2(float(x), float(y))) / Rf;
      if (r > 1.0 || r < 1e-6) continue;
      float w = bell(r, uKmu, uKsigma);          // ring-shaped kernel
      sum  += w * texture(uField, uv + vec2(float(x), float(y)) * px).r;
      wsum += w;
    }
  }
  float U = sum / max(wsum, 1e-6);               // neighbourhood "potential"
  float G = 2.0 * bell(U, uMu, uSigma) - 1.0;    // growth in [-1, +1]

  float a = texture(uField, uv).r;
  a = clamp(a + G / uT, 0.0, 1.0);

  if (uBrush.w > 0.0){
    vec2 d = (uv - uBrush.xy) * vec2(uGrid.x / uGrid.y, 1.0);
    float m = smoothstep(uBrush.z, 0.0, length(d));
    a = clamp(a + m * uBrush.w, 0.0, 1.0);
  }
  outColor = vec4(a, 0.0, 0.0, 1.0);
}`;

const F_RENDER = `#version 300 es
precision highp float;
${GLSL_LIB}
uniform sampler2D uField;
uniform vec2  uGrid;
uniform float uPalette;
in vec2 uv;
out vec4 outColor;

vec3 ramp(float t){
  if (uPalette < 0.5)                        // Bioluminescence
    return ramp4(t, vec3(0.012,0.020,0.038), vec3(0.040,0.130,0.210),
                    vec3(0.190,0.560,0.640), vec3(0.820,0.990,0.960));
  else if (uPalette < 1.5)                   // Amber specimen
    return ramp4(t, vec3(0.024,0.018,0.014), vec3(0.160,0.095,0.040),
                    vec3(0.720,0.470,0.150), vec3(1.000,0.930,0.760));
  else if (uPalette < 2.5)                   // Deep water
    return ramp4(t, vec3(0.008,0.016,0.034), vec3(0.030,0.090,0.200),
                    vec3(0.150,0.400,0.720), vec3(0.800,0.930,1.000));
  return ramp4(t, vec3(0.020,0.020,0.022), vec3(0.150,0.150,0.155),   // Micrograph
                  vec3(0.570,0.575,0.580), vec3(1.000,1.000,1.000));
}

void main(){
  float a = texture(uField, uv).r;
  vec3 col = ramp(a);
  // membrane highlight: the edge of a creature is where the gradient lives
  vec2 px = 1.0 / uGrid;
  float gx = texture(uField, uv + vec2(px.x,0)).r - texture(uField, uv - vec2(px.x,0)).r;
  float gy = texture(uField, uv + vec2(0,px.y)).r - texture(uField, uv - vec2(0,px.y)).r;
  float edge = length(vec2(gx, gy));
  col += vec3(0.55, 0.72, 0.80) * edge * 2.6 * a;
  outColor = vec4(tonemap(col), 1.0);
}`;

export default {
  id:'lenia', num:'IV', roman:'IV',
  title:'Lenia',
  subtitle:'Continuous cellular automata',
  attr:'Bert Wang-Chak Chan · 2019',
  accent:'#7aa6c2',
  desc:'Conway\'s Life made smooth in space, time and state. Cells stop being on-or-off, and what grows instead has membranes, division and repair.',
  text:`Conway's Game of Life is brutally discrete: cells are on or off, neighbourhoods are square, time comes in ticks. Bert Chan asked what happens if you sand all of that smooth — let a cell hold any value between 0 and 1, replace the square neighbourhood with a soft ring, and replace "exactly 3 neighbours" with a bell curve.<br><br>What you are looking at is what that rule does to random noise, at the exact parameters Chan published for his first creature, <em>Orbium</em>. Structures condense out of the soup within a few hundred ticks and then <b>stop changing size</b>. Each one holds a membrane against diffusion, divides when it grows too long, jostles its neighbours, and closes the wound if you tear it open — try painting through it.<br><br>A caveat worth putting on the wall: Chan's named creatures — <em>Orbium</em>, <em>Scutium</em>, <em>Hydrogeminium natans</em> — are not what random soup gives you. They are solitary, free-swimming solitons, and they were <em>found</em>, by hand and later by search, as specific starting patterns. Soup at these same numbers reliably lands here instead, in the colony phase. Both are the same rule; they are different attractors of it.<br><br>Nothing in that rule mentions organisms, membranes, division, healing or size. There is a ring, a bell curve, and a clock.`,
  code:`state A(x) ∈ [0,1]        kernel radius R

  K(r)  = exp( −½ · ((r − 0.5) / 0.15)² )   for 0 < r < 1
          normalised so Σ K = 1

  U(x)  = Σ K(‖y‖/R) · A(x + y)      ← "how much life is nearby"

  G(U)  = 2 · exp( −½ · ((U − μ)/σ)² ) − 1  ∈ [−1, +1]

  A(x) ← clamp( A(x) + G(U) / T , 0 , 1 )

Orbium:  R = 13   T = 10   μ = 0.15   σ = 0.015`,
  hint:'Tear a hole with the pointer and watch it close. σ is the knife edge — a thousandth either way and the colony dissolves or runs away.',
  ref:'<b>Chan, B. W-C.</b> (2019) Lenia: Biology of Artificial Life. <i>Complex Systems</i> 28(3).',
  gl:true,
  params:[
    {k:'mu',    label:'Growth centre μ', min:0.05, max:0.40, step:0.001, val:0.150, fmt:v=>v.toFixed(3)},
    {k:'sigma', label:'Growth width σ',  min:0.003,max:0.060,step:0.0005,val:0.0150,fmt:v=>v.toFixed(4)},
    {k:'ksigma',label:'Kernel width',    min:0.05, max:0.32, step:0.005, val:0.15, fmt:v=>v.toFixed(3)},
    {k:'T',     label:'Time constant T', min:2,    max:30,   step:1,     val:10},
    {k:'R',     label:'Kernel radius R', min:5,    max:16,   step:1,     val:12},
    {k:'density',label:'Inoculum density', min:0.08, max:1, step:0.02, val:0.34, fmt:v=>Math.round(v*100)+'%'},
    {k:'palette',label:'Palette', options:['Bioluminescence','Amber specimen','Deep water','Micrograph'], val:0}
  ],

  create(canvas, opts = {}){
    const preview = !!opts.preview;
    const gl = getContext(canvas);
    if (!gl) return null;
    emptyVAO(gl);

    const GW = preview ? 150 : 330;
    let   GH = Math.max(40, Math.round(GW * (canvas.height / Math.max(1, canvas.width))));

    const P = {mu:0.15, sigma:0.015, ksigma:0.15, T:10, R: preview ? 7 : 12, density:0.34, palette:0};
    if (opts.params) Object.assign(P, opts.params);

    const stepCache = new Map();               // R is baked in, so cache one program per R
    const getStep = R => {
      R = Math.max(3, Math.min(16, Math.round(R)));
      if (!stepCache.has(R)) stepCache.set(R, program(gl, VERT_QUAD, F_STEP(R)));
      return stepCache.get(R);
    };
    const pRender = program(gl, VERT_QUAD, F_RENDER);

    let field, brush = [0,0,0,0];

    function seed(){
      const data = new Float32Array(GW * GH * 4);
      // Primordial soup: low-frequency noise at roughly half the kernel
      // radius. Fine noise averages to a flat 0.5, which the growth rule
      // kills everywhere; *coarse* noise gives neighbourhoods that land
      // inside the narrow growth band, and structure condenses out of it.
      // Seeding only part of the plate leaves the resulting creatures room
      // to separate, travel and collide instead of jamming into a crystal.
      const R = Math.round(P.R);
      const st = Math.max(2, Math.round(R * 0.5));
      const cw = Math.ceil(GW / st) + 2, ch = Math.ceil(GH / st) + 2;
      const coarse = new Float32Array(cw * ch);
      for (let i = 0; i < coarse.length; i++) coarse[i] = Math.random();
      const at = (ix, iy) => coarse[Math.min(ch-1, iy) * cw + Math.min(cw-1, ix)];

      const patchR = R * 4.5;
      const nPatch = Math.max(1, Math.round(P.density * GW * GH / (Math.PI * patchR * patchR)));
      const patches = [];
      for (let i = 0; i < nPatch; i++)
        patches.push([Math.random() * GW, Math.random() * GH, patchR * (0.7 + Math.random() * 0.6)]);

      for (let y = 0; y < GH; y++){
        for (let x = 0; x < GW; x++){
          let mask = 0;
          for (const [px, py, pr] of patches){
            const d = Math.hypot(x - px, y - py) / pr;
            if (d < 1){ mask = Math.max(mask, 1 - d * d); if (mask > 0.99) break; }
          }
          if (mask <= 0.001) continue;
          const fx = x / st, fy = y / st;
          const ix = fx | 0, iy = fy | 0;
          let tx = fx - ix, ty = fy - iy;
          tx = tx*tx*(3-2*tx); ty = ty*ty*(3-2*ty);          // smoothstep
          const top = at(ix,iy)   + (at(ix+1,iy)   - at(ix,iy))   * tx;
          const bot = at(ix,iy+1) + (at(ix+1,iy+1) - at(ix,iy+1)) * tx;
          const v = top + (bot - top) * ty;
          data[(y*GW + x)*4] = Math.min(1, Math.max(0, v * Math.min(1, mask * 1.9)));
        }
      }
      field?.destroy();
      field = new PingPong(gl, GW, GH, {
        internal: gl.RGBA16F, format: gl.RGBA, type: gl.FLOAT,
        filter: gl.LINEAR, wrap: gl.REPEAT, data
      });
    }
    seed();

    function step(){
      gl.disable(gl.BLEND);
      const pStep = getStep(P.R);
      gl.useProgram(pStep);
      field.dst.bind();
      gl.uniform1i(pStep.u('uField'), field.src.use(0));
      gl.uniform2f(pStep.u('uGrid'), GW, GH);
      gl.uniform1f(pStep.u('uMu'), P.mu);
      gl.uniform1f(pStep.u('uSigma'), P.sigma);
      gl.uniform1f(pStep.u('uT'), P.T);
      gl.uniform1f(pStep.u('uKmu'), 0.5);
      gl.uniform1f(pStep.u('uKsigma'), P.ksigma);
      gl.uniform4f(pStep.u('uBrush'), brush[0], brush[1], brush[2], brush[3]);
      drawQuad(gl);
      field.swap();

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(pRender);
      gl.uniform1i(pRender.u('uField'), field.src.use(0));
      gl.uniform2f(pRender.u('uGrid'), GW, GH);
      gl.uniform1f(pRender.u('uPalette'), P.palette);
      drawQuad(gl);
    }

    return {
      step,
      set(k, v){ P[k] = v; if (k === 'density') seed(); },
      get(k){ return P[k]; },
      reset(){ seed(); },
      resize(){
        const want = Math.max(40, Math.round(GW * (canvas.height / Math.max(1, canvas.width))));
        if (Math.abs(want - GH) > GH * 0.06){ GH = want; seed(); }
      },
      pointer(x, y, down){ brush = [x, 1 - y, 0.05, down ? 0.09 : 0]; },
      count(){ return GW + '×' + GH + ' cells · kernel Ø' + (2*Math.round(P.R)+1); },
      destroy(){ field?.destroy(); gl.getExtension('WEBGL_lose_context')?.loseContext(); }
    };
  }
};
