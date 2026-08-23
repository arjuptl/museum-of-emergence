/* ════════════════════════════════════════════════════════════════
   III · TURING  —  Gray–Scott reaction–diffusion
   Two chemicals. One eats the other and reproduces by doing so.
   Turing predicted this printed the patterns on animals. He was right.
   ════════════════════════════════════════════════════════════════ */
import { getContext, program, VERT_QUAD, GLSL_LIB, PingPong, drawQuad, emptyVAO } from '../gl.js';

const F_STEP = `#version 300 es
precision highp float;
uniform sampler2D uField;
uniform vec2  uGrid;
uniform float uFeed, uKill, uDu, uDv, uDt;
uniform vec4  uBrush;            // x, y, radius, amount
in vec2 uv;
out vec4 outColor;

void main(){
  vec2 px = 1.0 / uGrid;
  // 9-point Laplacian: 0.05 on the diagonals, 0.20 on the edges
  vec2 lap = vec2(-1.0) * texture(uField, uv).rg;
  lap += 0.20 * texture(uField, uv + vec2( px.x, 0.0)).rg;
  lap += 0.20 * texture(uField, uv + vec2(-px.x, 0.0)).rg;
  lap += 0.20 * texture(uField, uv + vec2(0.0,  px.y)).rg;
  lap += 0.20 * texture(uField, uv + vec2(0.0, -px.y)).rg;
  lap += 0.05 * texture(uField, uv + px).rg;
  lap += 0.05 * texture(uField, uv - px).rg;
  lap += 0.05 * texture(uField, uv + vec2( px.x, -px.y)).rg;
  lap += 0.05 * texture(uField, uv + vec2(-px.x,  px.y)).rg;

  vec2 c = texture(uField, uv).rg;
  float u = c.r, v = c.g;
  float uvv = u * v * v;

  float du = uDu * lap.r - uvv + uFeed * (1.0 - u);
  float dv = uDv * lap.g + uvv - (uFeed + uKill) * v;

  u = clamp(u + du * uDt, 0.0, 1.0);
  v = clamp(v + dv * uDt, 0.0, 1.0);

  if (uBrush.w > 0.0){
    vec2 d = (uv - uBrush.xy) * vec2(uGrid.x / uGrid.y, 1.0);
    float m = smoothstep(uBrush.z, 0.0, length(d));
    v = mix(v, 1.0, m * uBrush.w);
    u = mix(u, 0.0, m * uBrush.w * 0.6);
  }
  outColor = vec4(u, v, 0.0, 1.0);
}`;

const F_RENDER = `#version 300 es
precision highp float;
${GLSL_LIB}
uniform sampler2D uField;
uniform vec2  uGrid;
uniform float uPalette, uGain;
in vec2 uv;
out vec4 outColor;

vec3 ramp(float t){
  if (uPalette < 0.5)                       // Malachite
    return ramp4(t, vec3(0.016,0.030,0.030), vec3(0.045,0.145,0.120),
                    vec3(0.290,0.610,0.440), vec3(0.880,0.980,0.900));
  else if (uPalette < 1.5)                  // Foxing — old paper and rust
    return ramp4(t, vec3(0.028,0.024,0.020), vec3(0.150,0.095,0.055),
                    vec3(0.660,0.430,0.230), vec3(0.980,0.930,0.820));
  else if (uPalette < 2.5)                  // Cyanotype
    return ramp4(t, vec3(0.012,0.020,0.040), vec3(0.045,0.100,0.230),
                    vec3(0.230,0.430,0.760), vec3(0.870,0.940,1.000));
  return ramp4(t, vec3(0.020,0.020,0.030), vec3(0.240,0.080,0.360),   // Spectrum plate
                  vec3(0.900,0.330,0.180), vec3(1.000,0.960,0.560));
}

void main(){
  vec2 px = 1.0 / uGrid;
  float v = texture(uField, uv).g;
  float t = clamp(v * uGain * 2.4, 0.0, 1.0);
  vec3 col = ramp(t);
  // relief lighting from the concentration gradient — gives the film a surface
  float gx = texture(uField, uv + vec2(px.x,0)).g - texture(uField, uv - vec2(px.x,0)).g;
  float gy = texture(uField, uv + vec2(0,px.y)).g - texture(uField, uv - vec2(0,px.y)).g;
  vec3 n = normalize(vec3(-gx * 42.0, -gy * 42.0, 1.0));
  float lambert = max(0.0, dot(n, normalize(vec3(-0.42, 0.55, 0.72))));
  col *= 0.72 + 0.55 * lambert;
  col += vec3(0.9, 0.85, 0.75) * pow(lambert, 26.0) * 0.30;
  outColor = vec4(tonemap(col), 1.0);
}`;

const RECIPES = {
  'Coral':        [0.0545, 0.0620],
  'Mitosis':      [0.0367, 0.0649],
  'Solitons':     [0.0300, 0.0620],
  'Worms':        [0.0780, 0.0610],
  'Spots':        [0.0350, 0.0650],
  'Labyrinth':    [0.0290, 0.0570],
  'Pulsing waves':[0.0250, 0.0600],
  'Fingerprint':  [0.0370, 0.0600]
};
const RECIPE_NAMES = Object.keys(RECIPES);

export default {
  id:'turing', num:'III', roman:'III',
  title:'Turing',
  subtitle:'Gray–Scott reaction–diffusion',
  attr:'Alan Turing 1952 · Gray & Scott 1984 · John Pearson 1993',
  accent:'#7fbfa4',
  desc:'Two chemicals, one of which eats the other and multiplies by eating. Spots, stripes, mitosis — the printing plate for animal skin.',
  text:`In 1952 — two years before his death, and long before anyone could compute the answer — Alan Turing published <em>The Chemical Basis of Morphogenesis</em>. Its claim was outrageous: that the spots on a leopard and the stripes on a fish require no map and no blueprint. Two substances diffusing at different speeds, one activating and one inhibiting, will spontaneously break their own symmetry and print a pattern.<br><br>What you are watching is the Gray–Scott system, the cleanest known instance. Chemical <em>U</em> is fed in everywhere. Chemical <em>V</em> converts U into more V, then is drained away. That's the entire chemistry: <b>U + 2V → 3V</b>.<br><br>Two numbers govern it — the <em>feed</em> and the <em>kill</em> rate — and the map of their possible values is one of the richest small parameter spaces in science. Move a thousandth of a unit and self-replicating blobs become writhing worms become a fingerprint. Nothing else changes. Only two numbers.`,
  code:`U + 2V → 3V        (V catalyses its own production)
      V → P          (V decays away)

every cell, 12 times a frame:

  ∂U/∂t = Dᵤ ∇²U − U·V²  +  f·(1 − U)
  ∂V/∂t = D᷎ᵥ ∇²V + U·V²  −  (f + k)·V

  Dᵤ = 1.0   D᷎ᵥ = 0.5    ∇² = 9-point stencil

f is the feed rate, k the kill rate.
Everything you will ever see here lives
inside 0.01 < f < 0.09,  0.045 < k < 0.07.`,
  hint:'Paint anywhere to inject V. Change the recipe and watch the film re-crystallise.',
  ref:'<b>Turing, A. M.</b> (1952) The chemical basis of morphogenesis. <i>Phil. Trans. R. Soc. B</i> 237. · <b>Pearson, J. E.</b> (1993) Complex patterns in a simple system. <i>Science</i> 261.',
  gl:true,
  params:[
    {k:'recipe', label:'Recipe', options:RECIPE_NAMES, val:0, onSet:true},
    {k:'feed',  label:'Feed rate f', min:0.010, max:0.090, step:0.0002, val:0.0545, fmt:v=>v.toFixed(4)},
    {k:'kill',  label:'Kill rate k', min:0.045, max:0.072, step:0.0002, val:0.0620, fmt:v=>v.toFixed(4)},
    {k:'speed', label:'Steps / frame', min:1, max:24, step:1, val:12},
    {k:'gain',  label:'Exposure', min:0.3, max:2.4, step:0.02, val:1.0, fmt:v=>v.toFixed(2)},
    {k:'palette', label:'Palette', options:['Malachite','Foxing','Cyanotype','Spectrum plate'], val:0}
  ],

  create(canvas, opts = {}){
    const preview = !!opts.preview;
    const gl = getContext(canvas);
    if (!gl) return null;
    emptyVAO(gl);

    const GW = preview ? 260 : 1000;
    let   GH = Math.max(48, Math.round(GW * (canvas.height / Math.max(1, canvas.width))));

    const pStep   = program(gl, VERT_QUAD, F_STEP);
    const pRender = program(gl, VERT_QUAD, F_RENDER);

    const P = {recipe:0, feed:0.0545, kill:0.0620, speed:preview ? 8 : 12, gain:1.0, palette:0};
    if (opts.params) Object.assign(P, opts.params);
    let field, brush = [0,0,0,0];

    function seed(){
      const data = new Float32Array(GW * GH * 4);
      for (let i = 0; i < GW*GH; i++){ data[i*4] = 1; data[i*4+1] = 0; }
      // a scatter of inoculation sites
      const sites = preview ? 9 : 22;
      for (let s = 0; s < sites; s++){
        const cx = Math.random()*GW, cy = Math.random()*GH, rad = 3 + Math.random()*7;
        for (let y = Math.max(0,(cy-rad)|0); y < Math.min(GH,cy+rad); y++)
          for (let x = Math.max(0,(cx-rad)|0); x < Math.min(GW,cx+rad); x++){
            if ((x-cx)**2 + (y-cy)**2 < rad*rad){
              const i = (y*GW + x) * 4;
              data[i] = 0.35 + Math.random()*0.2;
              data[i+1] = 0.55 + Math.random()*0.3;
            }
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
      gl.useProgram(pStep);
      const n = Math.round(P.speed);
      for (let i = 0; i < n; i++){
        field.dst.bind();
        gl.uniform1i(pStep.u('uField'), field.src.use(0));
        gl.uniform2f(pStep.u('uGrid'), GW, GH);
        gl.uniform1f(pStep.u('uFeed'), P.feed);
        gl.uniform1f(pStep.u('uKill'), P.kill);
        gl.uniform1f(pStep.u('uDu'), 1.0);
        gl.uniform1f(pStep.u('uDv'), 0.5);
        gl.uniform1f(pStep.u('uDt'), 1.0);
        // only paint on the first substep of the frame
        gl.uniform4f(pStep.u('uBrush'), brush[0], brush[1], brush[2], i === 0 ? brush[3] : 0);
        drawQuad(gl);
        field.swap();
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(pRender);
      gl.uniform1i(pRender.u('uField'), field.src.use(0));
      gl.uniform2f(pRender.u('uGrid'), GW, GH);
      gl.uniform1f(pRender.u('uGain'), P.gain);
      gl.uniform1f(pRender.u('uPalette'), P.palette);
      drawQuad(gl);
    }

    return {
      step,
      set(k, v){
        P[k] = v;
        if (k === 'recipe'){
          const [f, kk] = RECIPES[RECIPE_NAMES[Math.round(v)]];
          P.feed = f; P.kill = kk;
          return {feed:f, kill:kk};       // tell the host to move the sliders too
        }
      },
      get(k){ return P[k]; },
      reset(){ seed(); },
      resize(){
        const want = Math.max(48, Math.round(GW * (canvas.height / Math.max(1, canvas.width))));
        if (Math.abs(want - GH) > GH * 0.06){ GH = want; seed(); }
      },
      pointer(x, y, down){ brush = [x, 1 - y, 0.045, down ? 0.9 : 0]; },
      count(){ return GW + '×' + GH + ' cells · ' + Math.round(P.speed) + ' steps/frame'; },
      destroy(){ field?.destroy(); gl.getExtension('WEBGL_lose_context')?.loseContext(); }
    };
  }
};
