# Contributing an exhibit

The museum is unfinished on purpose. The rule for adding a room is deliberately
small — small enough that you can follow it alone, without asking anyone, and
without knowing what the whole collection will look like. That is rather the
point of the place.

**Everyone is welcome, including autonomous agents.** See
[Room IX](https://arjuptl.github.io/museum-of-emergence/agents.html) and
[`llms.txt`](llms.txt).

## The rule

1. Copy [`exhibit-template.js`](exhibit-template.js) to `js/exhibits/<your-id>.js`.
   It is a complete, working exhibit (Resnick's termites), so you can see the
   whole contract in one place.
2. Replace the model with yours.
3. Register it in `js/exhibits/index.js`.
4. Open a pull request.

That is the entire protocol. There is nothing to install and nothing to build.
Serve the folder with `python3 -m http.server 8899` and it runs.

## The contract

Your module default-exports one object:

| Field | Purpose |
|---|---|
| `id` | unique, lowercase; becomes the URL `#/<id>` |
| `title`, `subtitle`, `attr`, `accent`, `desc` | the wall label |
| `text`, `code`, `hint`, `ref` | the placard: essay, exact rule, interaction hint, citation |
| `gl` | `true` if you take a WebGL2 context, `false` for Canvas 2D |
| `prewarm` | frames to run before the first paint, so nobody meets a blank plate |
| `params` | the sliders and dropdowns a visitor gets |
| `create(canvas, opts)` | returns the running exhibit |

`create` returns `{ step, set, get, reset, resize, pointer, count, destroy }`.
All are required; `pointer` and `resize` may be no-ops. `opts.preview` is `true`
for the small live thumbnail in the atrium — use it to scale the work down.

## Hard constraints

A submission that breaks one of these cannot be merged. These are not style
preferences; the site's entire security posture rests on them.

- **No dependencies.** No npm, no CDN, no bundler, no build step. An empty
  supply chain cannot be poisoned.
- **No network access at runtime.** The site ships `connect-src 'none'`, so
  `fetch` and `XHR` do not function. Do not try to route around it.
- **No cookies, storage, telemetry or fingerprinting.**
- **No `eval`, `new Function`, or dynamic import of remote code.**
- **Your own implementation of a published model, with a real citation.**
  Do not paste code you did not write. Do not invent a reference — every
  citation on this site resolves to a real paper, and yours will be checked.
- **60fps at 1440×900 on integrated graphics.** Put the expensive setting
  behind a slider with a modest default.
- **Clean up in `destroy()`** — GL objects, timers, workers.

## What good looks like

The placard matters as much as the simulation. Write for a curious adult who
has never heard of your model. Say what is genuinely surprising and why it
happens. Avoid mysticism; the interest is in the mechanism.

**Make the placard describe what is actually on screen.** If your model has a
famous behaviour that your default parameters do not in fact produce, say so on
the wall rather than implying otherwise. There is already a worked example of
this in Room IV, where random soup reliably lands in Lenia's colony phase
rather than producing Chan's named creatures — and the placard says exactly
that. Accuracy beats a better story.

## Review

Every line is read by a human before merging. There is no automatic merge, no
bot with write access, and no endpoint on the site that accepts anything from
the internet at runtime. Review is the feature, not the bottleneck.

Expect questions about: whether the citation is real, whether the implementation
matches the paper, frame cost on a laptop, and whether the placard over-claims.

## Licence

By opening a pull request you agree your contribution is licensed MIT (code)
and CC BY 4.0 (prose), and that it is yours to give.
