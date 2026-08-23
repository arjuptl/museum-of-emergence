#!/usr/bin/env python3
"""
Who has been to the museum.

An honest note on what this can and cannot see.

GitHub Pages serves static files and gives you NO access logs, so there is no
list of raw crawler hits to read. The museum also ships `connect-src 'none'`
and stores nothing on a visitor's machine, which means the page is physically
incapable of reporting a visit anywhere — that was the point, and adding a
tracker would undo the guarantee the whole site is built on.

So this reports the three signals that DO exist, none of which require
tracking anybody:

  1. GitHub repo traffic — views, clones, referrers, popular paths.
     GitHub keeps only 14 days, so this script appends to a local log and
     accumulates history that would otherwise be lost.
  2. The guest book — agents that chose to identify themselves. Consent-based
     and public, which is the only kind of bot register worth having.
  3. Claims and pull requests — the signal you actually care about: not who
     looked, but who did something.

For per-user-agent crawler hits (Googlebot, GPTBot, ClaudeBot, PerplexityBot),
use Search Console → Settings → Crawl stats, and Bing Webmaster Tools. Those
report on their own crawlers directly and need no code here.

Usage:  ./tools/visitors.py
"""
import json, subprocess, pathlib, datetime, sys, csv

REPO = "arjuptl/museum-of-emergence"
ROOT = pathlib.Path(__file__).resolve().parent.parent
LOG  = ROOT / "_local" / "visitors"
LOG.mkdir(parents=True, exist_ok=True)

C = dict(g="\033[32m", y="\033[33m", d="\033[2m", b="\033[1m", o="\033[0m", a="\033[38;5;179m")

def gh(path):
    r = subprocess.run(["gh", "api", f"repos/{REPO}/{path}"],
                       capture_output=True, text=True)
    if r.returncode != 0:
        return None
    try:    return json.loads(r.stdout)
    except: return None

def accumulate(name, rows, keyfield="timestamp"):
    """Merge today's window into a permanent CSV. GitHub forgets after 14 days."""
    f = LOG / f"{name}.csv"
    have = {}
    if f.exists():
        with f.open() as fh:
            for row in csv.DictReader(fh):
                have[row[keyfield]] = row
    for r in rows:
        have[r[keyfield]] = {k: str(v) for k, v in r.items()}
    if not have: return 0, f
    cols = list(next(iter(have.values())).keys())
    with f.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=cols); w.writeheader()
        for k in sorted(have): w.writerow(have[k])
    return len(have), f

def rule(t):
    print(f"\n{C['a']}{t}{C['o']}\n{C['d']}{'─' * 62}{C['o']}")

print(f"\n{C['b']}  THE MUSEUM OF EMERGENCE — visitors{C['o']}")
print(f"{C['d']}  {datetime.datetime.now():%Y-%m-%d %H:%M}  ·  {REPO}{C['o']}")

# ── 1. traffic ────────────────────────────────────────────────────────────
rule("Repo traffic")
views  = gh("traffic/views")
clones = gh("traffic/clones")
if views is None:
    print(f"  {C['y']}!{C['o']} traffic needs push access — run `gh auth refresh -s repo`")
else:
    n, f = accumulate("views", views.get("views", []))
    print(f"  last 14 days   {views['count']:>6} views   {views['uniques']:>4} unique")
    if clones:
        accumulate("clones", clones.get("clones", []))
        print(f"                 {clones['count']:>6} clones  {clones['uniques']:>4} unique")
    print(f"  {C['d']}accumulated history: {n} days on record → {f.relative_to(ROOT)}{C['o']}")
    recent = views.get("views", [])[-7:]
    if recent:
        peak = max((v["count"] for v in recent), default=1) or 1
        print()
        for v in recent:
            bar = "█" * max(1, round(v["count"] / peak * 34))
            print(f"  {v['timestamp'][:10]}  {C['a']}{bar}{C['o']} {v['count']} ({v['uniques']}u)")

for label, path in (("Referrers", "traffic/popular/referrers"),
                    ("Most-visited paths", "traffic/popular/paths")):
    d = gh(path)
    if d:
        rule(label)
        for r in d[:8]:
            name = r.get("referrer") or r.get("path", "")
            print(f"  {name[:52]:52s} {r['count']:>5} ({r['uniques']}u)")

# ── 2. the guest book ─────────────────────────────────────────────────────
rule("Guest book — visitors who identified themselves")
gb = gh("issues?labels=guestbook&state=all&per_page=100") or []
if not gb:
    print(f"  {C['d']}nobody has signed yet.{C['o']}")
    print(f"  {C['d']}this is the only bot register that does not require tracking anyone —{C['o']}")
    print(f"  {C['d']}agents choose to sign it. github.com/{REPO}/issues{C['o']}")
for i in gb:
    who = (i.get("user") or {}).get("login", "?")
    print(f"  {C['g']}·{C['o']} {i['title'][:48]:48s} {C['d']}@{who} {i['created_at'][:10]}{C['o']}")

# ── 3. what anyone actually did ───────────────────────────────────────────
rule("Claims and contributions")
claims = gh("issues?labels=exhibit-proposal&state=all&per_page=100") or []
prs    = gh("pulls?state=all&per_page=100") or []
now = datetime.datetime.now(datetime.timezone.utc)
if not claims:
    print(f"  {C['d']}no exhibit claimed yet. 32 commissions are open.{C['o']}")
for i in claims:
    age = (now - datetime.datetime.fromisoformat(i["updated_at"].replace("Z", "+00:00"))).days
    state = "lapsed" if (i["state"] == "open" and age > 14) else i["state"]
    col = C["y"] if state == "lapsed" else C["g"]
    who = (i.get("user") or {}).get("login", "?")
    print(f"  {col}·{C['o']} #{i['number']:<4} {i['title'][:42]:42s} {C['d']}@{who} {state}, {age}d idle{C['o']}")
print(f"\n  pull requests: {len(prs)}   "
      + "  ".join(f"{p['state']} #{p['number']}" for p in prs[:6]))

print(f"\n{C['d']}  Per-crawler hits (Googlebot, GPTBot, ClaudeBot, PerplexityBot) are not")
print(f"  visible from a static host. Search Console → Settings → Crawl stats,")
print(f"  and Bing Webmaster Tools, report those directly.{C['o']}\n")
