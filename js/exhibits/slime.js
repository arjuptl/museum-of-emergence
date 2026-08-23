/* ════════════════════════════════════════════════════════════════
   II · SLIME  —  Physarum transport networks (Jones, 2010)
   A quarter-million particles, each with three forward-facing
   sensors, following a chemical they themselves lay down.
   ════════════════════════════════════════════════════════════════ */
import { getContext, program, VERT_QUAD, GLSL_LIB, Target, PingPong, drawQuad, emptyVAO } from '../gl.js';

const F_MOVE = `#version 300 es
precision highp float;
${GLSL_LIB}
uniform sampler2D uAgents;
uniform sampler2D uTrail;
uniform vec2  uGrid;
uniform float uTime, uSenseAngle, uSenseDist, uTurn, uStep;
uniform vec3  uPointer;              // x, y (grid px), strength (-1 repel .. 1 attract)
out vec4 outColor;

float sense(vec2 p, float a, float d){
  return texture(uTrail, (p + vec2(cos(a), sin(a)) * d) / uGrid).r;
}

void main(){
  ivec2 id = ivec2(gl_FragCoord.xy);
  vec4 A   = texelFetch(uAgents, id, 0);
  vec2  p    = A.xy;
  float ang  = A.z;
  float seed = A.w;

  float f = sense(p, ang, uSenseDist);
  float l = sense(p, ang + uSenseAngle, uSenseDist);
  float r = sense(p, ang - uSenseAngle, uSenseDist);

  float rnd = hash21(gl_FragCoord.xy * 1.37 + vec2(uTime * 60.0) + seed * 91.7);

  if (f >= l && f >= r){
    // strongest ahead: hold course
  } else if (f < l && f < r){
    ang += (rnd < 0.5 ? -1.0 : 1.0) * uTurn;      // ambiguous: pick a side
  } else if (l > r){
    ang += uTurn;
  } else {
    ang -= uTurn;
  }

  // a visitor's finger in the petri dish
  if (abs(uPointer.z) > 0.001){
    vec2 d = uPointer.xy - p;
    float dist = length(d);
    float fall = exp(-dist / (uGrid.x * 0.22));
    float want = atan(d.y, d.x) + (uPointer.z < 0.0 ? 3.14159265 : 0.0);
    float diff = atan(sin(want - ang), cos(want - ang));
    ang += diff * fall * abs(uPointer.z) * 0.34;
  }

  ang += (rnd - 0.5) * 0.13;                       // a little thermal noise
  p += vec2(cos(ang), sin(ang)) * uStep;
  p = mod(p + uGrid, uGrid);                       // torus

  outColor = vec4(p, ang, seed);
}`;

const V_DEPOSIT = `#version 300 es
precision highp float;
uniform sampler2D uAgents;
uniform vec2 uGrid;
uniform int  uAW;
void main(){
  int i = gl_VertexID;
  ivec2 id = ivec2(i % uAW, i / uAW);
  vec2 p = texelFetch(uAgents, id, 0).xy;
  gl_Position  = vec4((p / uGrid) * 2.0 - 1.0, 0.0, 1.0);
  gl_PointSize = 1.0;
}`;

const F_DEPOSIT = `#version 300 es
precision highp float;
uniform float uDeposit;
out vec4 outColor;
void main(){ outColor = vec4(uDeposit, uDeposit * 0.5, 0.0, 1.0); }`;

const F_DIFFUSE = `#version 300 es
precision highp float;
uniform sampler2D uTrail;
uniform vec2  uGrid;
uniform float uDecay, uBlur;
in vec2 uv;
out vec4 outColor;
void main(){
  vec2 px = 1.0 / uGrid;
  vec4 sum = vec4(0.0);
  for (int y = -1; y <= 1; y++)
    for (int x = -1; x <= 1; x++)
      sum += texture(uTrail, uv + vec2(float(x), float(y)) * px);
  vec4 blurred = sum / 9.0;
  vec4 here    = texture(uTrail, uv);
  outColor = mix(here, blurred, uBlur) * uDecay;
}`;

const F_RENDER = `#version 300 es
precision highp float;
${GLSL_LIB}
uniform sampler2D uTrail;
uniform vec2  uGrid;
uniform float uGain, uPalette;
in vec2 uv;
out vec4 outColor;

vec3 ramp(float t){
  if (uPalette < 0.5)                      // Gilt — the house palette
    return ramp4(t, vec3(0.012,0.014,0.020), vec3(0.170,0.105,0.038),
                    vec3(0.760,0.560,0.220), vec3(1.000,0.945,0.790));
  else if (uPalette < 1.5)                 // Verdigris
    return ramp4(t, vec3(0.010,0.020,0.024), vec3(0.040,0.170,0.155),
                    vec3(0.230,0.640,0.500), vec3(0.880,1.000,0.930));
  else if (uPalette < 2.5)                 // Cinnabar
    return ramp4(t, vec3(0.020,0.010,0.020), vec3(0.190,0.045,0.080),
                    vec3(0.800,0.250,0.180), vec3(1.000,0.880,0.700));
  return ramp4(t, vec3(0.015,0.016,0.020), vec3(0.140,0.150,0.165),   // Silver print
                  vec3(0.560,0.575,0.600), vec3(1.000,1.000,1.000));
}

void main(){
  float v = texture(uTrail, uv).r * uGain;
  float t = 1.0 - exp(-v * 1.9);           // soft saturation, never clips ugly
  vec3 col = ramp(t);
  // a whisper of edge relief so the network reads as filament, not fog
  vec2 px = 1.5 / uGrid;
  float dx = texture(uTrail, uv + vec2(px.x,0)).r - texture(uTrail, uv - vec2(px.x,0)).r;
  float dy = texture(uTrail, uv + vec2(0,px.y)).r - texture(uTrail, uv - vec2(0,px.y)).r;
  col += vec3(0.30, 0.27, 0.22) * clamp((dx + dy) * uGain * 0.55, 0.0, 1.0) * smoothstep(0.02, 0.25, t);
  outColor = vec4(tonemap(col), 1.0);
}`;

export default {
  id:'slime', num:'II', roman:'II',
  title:'Slime',
  subtitle:'Physarum transport networks',
  attr:'after Jeff Jones · 2010 · and the organism itself, ~1 billion BCE',
  accent:'#e0c589',
  desc:'A quarter-million particles, three sensors each, following a scent they secrete themselves. They rediscover the Tokyo rail network.',
  text:`A true slime mould is one enormous cell with thousands of nuclei and no brain whatsoever. Put oat flakes on a map of Japan at the positions of its cities and <em>Physarum polycephalum</em> will grow a feeding network that a transport engineer would recognise — Tokyo's rail system, more or less, arrived at overnight without a single act of planning.<br><br>Jones' 2010 model reduces the organism to almost nothing: particles that walk forward, sniff three points ahead, and turn toward whichever smells strongest, while dripping the very same attractant behind them. Positive feedback does the rest. A path used becomes a path preferred becomes a path.<br><br>The whole character of the thing lives in two angles. When the <em>turn</em> exceeds the <em>sensor spread</em>, an agent following a filament overshoots its own trail — and the network spontaneously sprouts branches. Drag it below and everything contracts into taut, minimal arcs.`,
  code:`for each of 262,144 particles, every frame:

    F = trail sampled  d px ahead
    L = trail sampled  d px ahead, rotated +β
    R = trail sampled  d px ahead, rotated −β

    if F ≥ L and F ≥ R   →  keep heading
    else if F < L and F < R →  turn ±α at random
    else if L > R        →  heading += α
    else                 →  heading −= α

    position += heading · step
    deposit at position

then, over the whole trail field:
    blur 3×3, multiply by decay`,
  hint:'Drag on the culture to lead the colony. Hold ⇧ Shift to repel.',
  ref:'<b>Jones, J.</b> (2010) Characteristics of pattern formation and evolution in approximations of Physarum transport networks. <i>Artificial Life</i> 16(2).',
  gl:true,
  prewarm:320,
  params:[
    {k:'sense',  label:'Sensor spread β', min:5,   max:80,  step:0.5, val:22.5, unit:'°'},
    {k:'turn',   label:'Turn angle α',    min:5,   max:80,  step:0.5, val:45,   unit:'°'},
    {k:'dist',   label:'Sensor reach',    min:1,   max:40,  step:0.5, val:6,    unit:'px'},
    {k:'step',   label:'Speed',           min:0.2, max:3,   step:0.05,val:0.9,  unit:'px'},
    {k:'decay',  label:'Evaporation',     min:0.80,max:0.995,step:0.001,val:0.900, fmt:v=>((1-v)*100).toFixed(1)+'%'},
    {k:'blur',   label:'Diffusion',       min:0,   max:1,   step:0.01,val:0.22, fmt:v=>v.toFixed(2)},
    {k:'gain',   label:'Exposure',        min:0.2, max:6,   step:0.05,val:0.60, fmt:v=>v.toFixed(2)},
    {k:'palette',label:'Palette', options:['Gilt','Verdigris','Cinnabar','Silver print'], val:0}
  ],

  create(canvas, opts = {}){
    const preview = !!opts.preview;
    const gl = getContext(canvas);
    if (!gl) return null;
    emptyVAO(gl);

    const AW    = preview ? 208 : 768;              // agent texture is AW×AW
    const N     = AW * AW;
    const GW    = preview ? 460 : 1800;             // trail width in sim pixels
    let   GH    = Math.max(64, Math.round(GW * (canvas.height / Math.max(1, canvas.width))));

    const pMove    = program(gl, VERT_QUAD, F_MOVE);
    const pDeposit = program(gl, V_DEPOSIT, F_DEPOSIT);
    const pDiffuse = program(gl, VERT_QUAD, F_DIFFUSE);
    const pRender  = program(gl, VERT_QUAD, F_RENDER);

    let agents, trail;
    const P = {sense:22.5, turn:45, dist:6, step:0.9, decay:0.900, blur:0.22, gain:0.60, palette:0};
    if (opts.params) Object.assign(P, opts.params);
    let pointer = [0, 0, 0], time = 0;

    function seedAgents(){
      const data = new Float32Array(N * 4);
      for (let i = 0; i < N; i++){
        // scattered uniformly with random headings — the whole plate
        // condenses into a network within a couple of seconds
        data[i*4    ] = Math.random() * GW;
        data[i*4 + 1] = Math.random() * GH;
        data[i*4 + 2] = Math.random() * Math.PI * 2;
        data[i*4 + 3] = Math.random() * 100;
      }
      agents?.destroy();
      agents = new PingPong(gl, AW, AW, {
        internal: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT,
        filter: gl.NEAREST, wrap: gl.CLAMP_TO_EDGE, data
      });
    }

    function buildField(){
      trail?.destroy();
      trail = new PingPong(gl, GW, GH, {
        internal: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT,
        filter: gl.LINEAR, wrap: gl.REPEAT
      });
      for (const t of [trail.a, trail.b]){
        t.bind(); gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT);
      }
    }

    buildField(); seedAgents();

    const RAD = Math.PI / 180;

    function step(dt){
      time += dt;
      gl.disable(gl.BLEND);

      /* 1 — sense and move */
      gl.useProgram(pMove);
      agents.dst.bind();
      gl.uniform1i(pMove.u('uAgents'), agents.src.use(0));
      gl.uniform1i(pMove.u('uTrail'),  trail.src.use(1));
      gl.uniform2f(pMove.u('uGrid'), GW, GH);
      gl.uniform1f(pMove.u('uTime'), time);
      gl.uniform1f(pMove.u('uSenseAngle'), P.sense * RAD);
      gl.uniform1f(pMove.u('uSenseDist'),  P.dist);
      gl.uniform1f(pMove.u('uTurn'),       P.turn * RAD);
      gl.uniform1f(pMove.u('uStep'),       P.step);
      gl.uniform3f(pMove.u('uPointer'), pointer[0]*GW, (1-pointer[1])*GH, pointer[2]);
      drawQuad(gl);
      agents.swap();

      /* 2 — the field evaporates and spreads */
      gl.useProgram(pDiffuse);
      trail.dst.bind();
      gl.uniform1i(pDiffuse.u('uTrail'), trail.src.use(0));
      gl.uniform2f(pDiffuse.u('uGrid'), GW, GH);
      gl.uniform1f(pDiffuse.u('uDecay'), P.decay);
      gl.uniform1f(pDiffuse.u('uBlur'),  P.blur);
      drawQuad(gl);
      trail.swap();

      /* 3 — every agent drips attractant */
      gl.useProgram(pDeposit);
      trail.src.bind();
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.uniform1i(pDeposit.u('uAgents'), agents.src.use(0));
      gl.uniform2f(pDeposit.u('uGrid'), GW, GH);
      gl.uniform1i(pDeposit.u('uAW'), AW);
      gl.uniform1f(pDeposit.u('uDeposit'), 0.10);
      gl.drawArrays(gl.POINTS, 0, N);
      gl.disable(gl.BLEND);

      /* 4 — print it */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(pRender);
      gl.uniform1i(pRender.u('uTrail'), trail.src.use(0));
      gl.uniform2f(pRender.u('uGrid'), GW, GH);
      gl.uniform1f(pRender.u('uGain'), P.gain);
      gl.uniform1f(pRender.u('uPalette'), P.palette);
      drawQuad(gl);
    }

    return {
      step,
      set(k, v){ P[k] = v; },
      get(k){ return P[k]; },
      reset(){ buildField(); seedAgents(); },
      resize(){
        const want = Math.max(64, Math.round(GW * (canvas.height / Math.max(1, canvas.width))));
        if (Math.abs(want - GH) > GH * 0.06){ GH = want; buildField(); seedAgents(); }
      },
      pointer(x, y, down, shift){ pointer = down ? [x, y, shift ? -1 : 1] : [x, y, 0]; },
      count(){ return N.toLocaleString() + ' particles · ' + GW + '×' + GH + ' field'; },
      destroy(){ agents?.destroy(); trail?.destroy();
                 gl.getExtension('WEBGL_lose_context')?.loseContext(); }
    };
  }
};
