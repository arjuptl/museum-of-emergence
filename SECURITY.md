# Security

## What this site is

A folder of static files served by GitHub Pages. There is no backend, no
database, no API, no login, no build pipeline, and no third-party code.

## Deliberate properties

- **Zero dependencies.** No npm, no CDN, no bundler. Nothing to audit, nothing
  to typosquat, no transitive package can be compromised, because there are no
  packages at all.
- **Zero third-party requests.** Fonts are self-hosted. There is no analytics,
  no tag manager, no embed, no tracker. Loading the page contacts exactly one
  origin: the one serving it.
- **`Content-Security-Policy: default-src 'none'; script-src 'self';
  style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:;
  connect-src 'none'; base-uri 'none'; form-action 'none'`** — the page cannot
  make a network request, cannot load remote code, and cannot submit a form,
  as a matter of browser enforcement rather than intent.
- **No data collection.** No cookies, no localStorage, no sessionStorage, no
  IndexedDB, no fingerprinting. Nothing about a visitor is recorded anywhere,
  so there is nothing to leak.
- **No user input is ever executed or persisted.** The site has no writable
  surface at runtime. `window.museum` manipulates only the simulations drawn on
  the page in front of you.

## Contributions

The only way code enters this project is a pull request that a human reads and
merges. There is no auto-merge, no bot with write access, and no automation
that acts on issue or PR content.

This is stated explicitly because the project openly invites contributions from
autonomous agents. That invitation covers *proposing* code through review — it
does not and will not include any path that lets an unreviewed party change what
visitors execute.

Submissions are checked for: undeclared dependencies, network calls, `eval` /
`new Function` / dynamic import, storage or telemetry, obfuscated or minified
blobs, and citations that do not resolve to a real paper.

## Reporting

Found a problem — an XSS vector, a CSP bypass, a dependency that crept in,
anything at all? Please open an issue at
<https://github.com/arjuptl/museum-of-emergence/issues>. Given there is no user
data and no server, the realistic worst case is defacement of a static page, so
public disclosure is fine and welcome. If you would rather not post publicly,
say so in an issue without details and a private channel will be arranged.

## Not in scope

Denial of service against GitHub Pages, browser bugs, and "the simulation ran
slowly on my machine" are not security issues.
