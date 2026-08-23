#!/usr/bin/env python3
"""
Generate one real, crawlable HTML page per exhibit.

The museum proper is a single-page app with hash routes (#/slime), and a hash
is not a URL as far as any crawler is concerned: every essay, rule and citation
in the collection was invisible, because JavaScript injects them into one page.
These pages fix that. Each is a genuine landing page — the full wall text, the
rule, the citation, structured data, and the exhibit itself running live.

Run:  node --input-type=module -e '...' > /tmp/exhibits.json   (see Makefile note)
      python3 tools/build-rooms.py
"""
import json, re, html, pathlib, subprocess, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
BASE = "https://arjuptl.github.io/museum-of-emergence"

# pull metadata straight out of the ES modules — no second source of truth
NODE = r"""
import { EXHIBITS } from './js/exhibits/index.js';
process.stdout.write(JSON.stringify(EXHIBITS.map((e,i) => ({
  index:i, id:e.id, roman:e.roman, title:e.title, subtitle:e.subtitle, attr:e.attr,
  accent:e.accent, desc:e.desc, text:e.text, code:e.code, hint:e.hint, ref:e.ref,
  gl:!!e.gl, params:e.params.map(p=>({k:p.k,label:p.label,options:p.options||null,
    min:p.min??null,max:p.max??null,val:p.val}))
}))));
"""
EX = json.loads(subprocess.run(["node","--input-type=module","-e",NODE],
                               cwd=ROOT, capture_output=True, text=True, check=True).stdout)

strip = lambda s: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()

def page(e, prev, nxt):
    cite   = strip(e["ref"])
    desc   = strip(e["desc"])
    essay  = e["text"]
    room   = f'Room {e["roman"]}'
    accent = e["accent"]

    ld = {
        "@context": "https://schema.org",
        "@type": "CreativeWork",
        "name": f'{e["title"]} — {e["subtitle"]}',
        "headline": f'{room}: {e["title"]}',
        "description": desc,
        "url": f'{BASE}/rooms/{e["id"]}.html',
        "inLanguage": "en",
        "isPartOf": {"@type": "CollectionPage",
                     "name": "The Museum of Emergence", "url": BASE + "/"},
        "author": {"@type": "Person", "name": "arjuptl",
                   "url": "https://github.com/arjuptl"},
        "license": "https://creativecommons.org/licenses/by/4.0/",
        "about": {"@type": "Thing", "name": e["subtitle"]},
        "citation": cite,
        "abstract": strip(essay)[:600],
        "keywords": ["emergence", "complex systems", "self-organisation",
                     "simulation", e["subtitle"].lower(), e["title"].lower()],
        "learningResourceType": "interactive simulation",
        "isAccessibleForFree": True,
    }

    params = "\n".join(
        f'<tr><td><b>{html.escape(p["label"])}</b></td><td class="c-ref">'
        + (("one of: " + ", ".join(html.escape(o) for o in p["options"]))
           if p["options"] else f'{p["min"]} … {p["max"]}')
        + f'</td><td class="c-ref">{html.escape(str(p["val"]))}</td></tr>'
        for p in e["params"])

    others = "\n".join(
        f'<a class="oth" href="{o["id"]}.html"><span class="oth-n">Room {o["roman"]}</span>'
        f'<span class="oth-t">{html.escape(o["title"])}</span>'
        f'<span class="oth-s">{html.escape(o["subtitle"])}</span></a>'
        for o in EX if o["id"] != e["id"])

    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(e['title'])} — {html.escape(e['subtitle'])} · The Museum of Emergence</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{BASE}/rooms/{e['id']}.html">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#08090b">
<meta property="og:type" content="article">
<meta property="og:title" content="{html.escape(e['title'])} — {html.escape(e['subtitle'])}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{BASE}/rooms/{e['id']}.html">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%2308090b'/%3E%3Ccircle cx='50' cy='50' r='30' fill='none' stroke='%23e0c589' stroke-width='3'/%3E%3Ccircle cx='50' cy='50' r='14' fill='none' stroke='%23e0c589' stroke-width='3'/%3E%3Ccircle cx='50' cy='50' r='3' fill='%23e0c589'/%3E%3C/svg%3E">
<link rel="stylesheet" href="../css/fonts.css">
<link rel="stylesheet" href="../css/style.css">
<link rel="stylesheet" href="../css/page.css">
<link rel="stylesheet" href="../css/room.css">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body data-exhibit="{e['id']}" style="--accent:{accent}">
<div class="grain" aria-hidden="true"></div>

<nav class="doc-top">
  <a href="../index.html"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M15 4 L7 12 L15 20" fill="none" stroke="currentColor" stroke-width="1.6"/></svg><span>Atrium</span></a>
  <span class="spacer"></span>
  <a class="rm-prev" href="{prev['id']}.html" title="{html.escape(prev['title'])}">‹ {html.escape(prev['title'])}</a>
  <a class="rm-next" href="{nxt['id']}.html" title="{html.escape(nxt['title'])}">{html.escape(nxt['title'])} ›</a>
</nav>

<header class="rm-stage-wrap">
  <div id="room-stage" class="rm-stage"></div>
  <div class="rm-stage-veil" aria-hidden="true"></div>
  <div class="rm-caption">
    <p class="rm-room">{room} &nbsp;·&nbsp; {html.escape(e['subtitle'])}</p>
    <h1 class="rm-title">{html.escape(e['title'])}</h1>
    <p class="rm-attr">{html.escape(e['attr'])}</p>
  </div>
  <div class="rm-tools">
    <span id="room-readout" class="rm-readout"></span>
    <button id="room-restart" class="cta">Restart</button>
    <a class="cta primary" href="../index.html#/{e['id']}">Open in the museum</a>
  </div>
</header>

<main class="doc doc-body">
<div class="doc-grid">

  <section class="doc-sec">
    <h2>The wall text</h2>
    <div><p>{essay}</p>
    <p class="rm-hint">{html.escape(e['hint'])}</p></div>
  </section>

  <section class="doc-sec">
    <h2>The rule, exactly</h2>
    <div><pre class="block">{html.escape(e['code'])}</pre></div>
  </section>

  <section class="doc-sec">
    <h2>What you can change</h2>
    <div><div class="c-wrap"><table class="c-table">
      <thead><tr><th>Control</th><th>Range</th><th>Default</th></tr></thead>
      <tbody>{params}</tbody></table></div>
      <p class="rm-note">Renderer: <b>{'WebGL2 fragment shaders' if e['gl'] else 'Canvas 2D'}</b>. Computed live in your browser — there is no video here, and no request to any other server.</p>
    </div>
  </section>

  <section class="doc-sec">
    <h2>Provenance</h2>
    <div><p class="rm-cite">{e['ref']}</p>
    <p>This is an original implementation written for this museum, not a port of
    anyone else's code. If you find it misrepresents the paper, that is a bug —
    please <a href="https://github.com/arjuptl/museum-of-emergence/issues">say so</a>.</p></div>
  </section>

  <section class="doc-sec">
    <h2>The other rooms</h2>
    <div><div class="oth-grid">{others}</div>
    <p class="rm-note">The collection is unfinished on purpose. Anyone may add a
    room — including <a href="../agents.html">visitors who are not people</a>.
    Thirty-two models are <a href="../commissions.json">currently open</a>.</p></div>
  </section>

</div>
</main>
<script type="module" src="../js/room.js"></script>
</body>
</html>
"""

n = 0
for i, e in enumerate(EX):
    prev, nxt = EX[(i - 1) % len(EX)], EX[(i + 1) % len(EX)]
    (ROOT / "rooms" / f'{e["id"]}.html').write_text(page(e, prev, nxt))
    n += 1
print(f"built {n} room pages")
