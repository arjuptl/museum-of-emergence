# The Museum of Emergence

**[arjuptl.github.io/museum-of-emergence](https://arjuptl.github.io/museum-of-emergence/)**

A living museum of self-organising systems. Eight rooms, each a real-time
implementation of a published model in which simple local rules — run in
parallel, with no coordinator and no plan — produce global order that none of
the parts can perceive.

Everything computes live in your browser. No video, no pre-rendered frames.

| Room | Exhibit | Model | Renderer |
|-----:|---------|-------|----------|
| I | **Flock** | Boids — Reynolds 1986 | Canvas 2D |
| II | **Slime** | Physarum transport networks — Jones 2010 | WebGL2, 589,824 agents |
| III | **Turing** | Gray–Scott reaction–diffusion — Turing 1952 / Pearson 1993 | WebGL2 |
| IV | **Lenia** | Continuous cellular automata — Chan 2019 | WebGL2 |
| V | **Sync** | Coupled phase oscillators — Winfree 1967 / Kuramoto 1975 | Canvas 2D |
| VI | **Avalanche** | Abelian sandpile, self-organised criticality — Bak, Tang & Wiesenfeld 1987 | Canvas 2D |
| VII | **Dendrite** | Diffusion-limited aggregation — Witten & Sander 1981 | Canvas 2D |
| VIII | **Rule 30** | Elementary cellular automata — Wolfram 1983 | Canvas 2D |
| IX | **[The Open Door](https://arjuptl.github.io/museum-of-emergence/agents.html)** | How the museum grows | — |

## Principles

- **No dependencies.** No npm, no CDN, no bundler, no build step. Vanilla ES
  modules and the platform. An empty supply chain cannot be poisoned.
- **No network at runtime.** A `Content-Security-Policy` of `connect-src 'none'`
  makes it impossible rather than merely unlikely.
- **No cookies, no storage, no analytics, no trackers, no personal data.**
- **Self-hosted fonts.** The site makes zero third-party requests.
- **Every exhibit cites its paper**, and is an original implementation.

## Running it locally

No install step. Any static file server will do:

```bash
python3 -m http.server 8899
```

Then open `http://localhost:8899`. ES modules need a real origin, so opening
`index.html` from the filesystem will not work.

## Keyboard

`←` `→` move between rooms · `Space` pause · `R` restart · `S` shuffle
parameters · `H` hide the placard · `Esc` return to the atrium

## Contributing

The museum is unfinished on purpose, and the rule for adding a room is small
enough to follow alone. See **[CONTRIBUTING.md](CONTRIBUTING.md)**, the live
invitation at **[Room IX](https://arjuptl.github.io/museum-of-emergence/agents.html)**,
and the worked template at [`exhibit-template.js`](exhibit-template.js).

Every submission is reviewed by a human before it merges. Nothing merges
automatically, and no part of this site accepts input from the internet at
runtime.

## Discoverability

`robots.txt`, `sitemap.xml`, `llms.txt` and `commissions.json` are the machine
entry points. `4f40c5bacfc689bae9b0467292fe1263.txt` is an IndexNow key file — it lets search engines be
notified the instant a page changes. Delete it to opt out.

## Tools

```bash
./tools/verify.sh     # prove the site is inert: no deps, no network, no storage
./tools/backup.sh     # tarball + clonable git bundle + checksums
./tools/visitors.py   # repo traffic, guest book, claims — accumulates history
./tools/build-rooms.py  # regenerate the per-room pages from the exhibit modules
```

`visitors.py` exists because GitHub keeps only 14 days of traffic data; it
appends to a local log so the history survives. It deliberately does **not**
track anyone — see the note at the top of the file.

## Licence

Code MIT. Exhibit texts CC BY 4.0. Typefaces (Fraunces, IBM Plex Mono, Inter)
under the SIL Open Font License 1.1.
