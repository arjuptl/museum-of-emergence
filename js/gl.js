/* ────────────────────────────────────────────────────────────────
   gl.js — a small WebGL2 helper for ping-pong field simulations.
   Everything here is fullscreen-triangle work: no meshes, no matrices.
   ──────────────────────────────────────────────────────────────── */

export const VERT_QUAD = `#version 300 es
precision highp float;
out vec2 uv;
void main(){
  // fullscreen triangle from gl_VertexID — no buffers needed
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  uv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

export function getContext(canvas){
  const gl = canvas.getContext('webgl2', {
    alpha:false, antialias:false, depth:false, stencil:false,
    premultipliedAlpha:false, preserveDrawingBuffer:true,
    powerPreference:'high-performance', desynchronized:true
  });
  if (!gl) return null;
  const ext = gl.getExtension('EXT_color_buffer_float');
  if (!ext) return null;                       // we need float render targets
  gl.getExtension('OES_texture_float_linear'); // optional; 16F is linear-filterable in core
  gl.disable(gl.DEPTH_TEST);
  gl.disable(gl.CULL_FACE);
  return gl;
}

function shader(gl, type, src){
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)){
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l,i)=>String(i+1).padStart(3)+'| '+l).join('\n');
    gl.deleteShader(s);
    throw new Error('shader compile failed:\n'+log+'\n'+numbered);
  }
  return s;
}

export function program(gl, vsSrc, fsSrc){
  const p = gl.createProgram();
  const vs = shader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = shader(gl, gl.FRAGMENT_SHADER, fsSrc);
  gl.attachShader(p, vs); gl.attachShader(p, fs); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)){
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p); throw new Error('link failed: '+log);
  }
  gl.deleteShader(vs); gl.deleteShader(fs);
  // cache uniform locations lazily
  const cache = new Map();
  p.u = name => {
    if (!cache.has(name)) cache.set(name, gl.getUniformLocation(p, name));
    return cache.get(name);
  };
  return p;
}

/** A texture + framebuffer pair you can render into and sample from. */
export class Target {
  constructor(gl, w, h, {internal = gl.RGBA16F, format = gl.RGBA, type = gl.HALF_FLOAT,
                         filter = gl.LINEAR, wrap = gl.REPEAT, data = null} = {}){
    w = Math.max(1, w|0); h = Math.max(1, h|0);   // a 0-sized FBO is an incomplete FBO
    this.gl = gl; this.w = w; this.h = h;
    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    this.fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }
  bind(){                       // render *into* this target
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.viewport(0, 0, this.w, this.h);
  }
  use(unit){                    // sample *from* this target
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    return unit;
  }
  upload(data){
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, this.w, this.h,
      this._format ?? gl.RGBA, this._type ?? gl.FLOAT, data);
  }
  destroy(){ this.gl.deleteTexture(this.tex); this.gl.deleteFramebuffer(this.fbo); }
}

/** Two Targets you alternate between. `.src` reads, `.dst` writes, `.swap()`. */
export class PingPong {
  constructor(gl, w, h, opts){
    this.a = new Target(gl, w, h, opts);
    this.b = new Target(gl, w, h, opts);
    this._flip = false;
  }
  get src(){ return this._flip ? this.b : this.a; }
  get dst(){ return this._flip ? this.a : this.b; }
  swap(){ this._flip = !this._flip; }
  destroy(){ this.a.destroy(); this.b.destroy(); }
}

/** Draw the fullscreen triangle (requires a bound program + VAO). */
export function drawQuad(gl){ gl.drawArrays(gl.TRIANGLES, 0, 3); }

/** WebGL2 still wants *some* VAO bound; make one empty one and keep it. */
export function emptyVAO(gl){
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  return vao;
}

/* A handful of GLSL snippets the exhibits share. */
export const GLSL_LIB = `
float hash11(float p){ p = fract(p*0.1031); p *= p+33.33; p *= p+p; return fract(p); }
vec2  hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.xx+p3.yz)*p3.zy);
}
float hash21(vec2 p){
  vec3 p3 = fract(vec3(p.xyx)*.1031);
  p3 += dot(p3, p3.yzx+33.33);
  return fract((p3.x+p3.y)*p3.z);
}
/* Inigo Quilez's cosine palette — cheap, always harmonious. */
vec3 pal(float t, vec3 a, vec3 b, vec3 c, vec3 d){
  return a + b*cos(6.28318530718*(c*t+d));
}
/* A 4-stop ramp with smooth joints. Unlike a cosine palette this is
   *predictable*: stop 0 is exactly what you see where the field is empty. */
vec3 ramp4(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3){
  t = clamp(t, 0.0, 1.0);
  vec3 a = mix(c0, c1, smoothstep(0.00, 0.34, t));
  vec3 b = mix(a,  c2, smoothstep(0.28, 0.72, t));
  return  mix(b,  c3, smoothstep(0.64, 1.00, t));
}
vec3 tonemap(vec3 x){                 // gentle filmic curve, keeps highlights alive
  x = max(vec3(0.0), x);
  return (x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14);
}
`;
