# Tesla inventory monitor

Watches Tesla's new-vehicle inventory for the cars you care about and emails
two (or more) people the moment one appears, so whoever is nearest a browser
can put the deposit down first.

It runs on **GitHub Actions**, every 5 minutes, for free. Nothing on your
laptop or phone has to stay open, and it uses no Claude usage. You start,
stop and watch it from the GitHub app on your phone.

What it watches is in `config.json`. Out of the box:

| Search | Centre | Radius | Trim filter |
|---|---|---|---|
| Model Y Premium RWD | Allen, TX 75013 (Dallas) | 200 mi | trim contains "Premium Rear-Wheel Drive" (or the older "Long Range Rear-Wheel Drive") |
| Model Y AWD | Chicago, IL 60601 | 200 mi | trim contains "All-Wheel Drive" (Premium AWD *and* Performance); add `"Performance"` to `exclude_keywords` to drop Performance |

200 miles is the widest radius Tesla's site allows. Set `"range_miles": 0` to
search the whole country. Only new cars (`"condition": "new"`) are returned.

## One-time setup (about 10 minutes, all doable from a phone)

### 1. A mailbox to send from

Use a Gmail account (a throwaway is fine):

1. Turn on 2-Step Verification: <https://myaccount.google.com/security>
2. Create an **App password**: <https://myaccount.google.com/apppasswords>
   Name it "tesla monitor" and copy the 16-character password.

### 2. Repository secrets

In GitHub: **repo → Settings → Secrets and variables → Actions → New repository secret**.
(On the phone app, open the repo in the browser for this part.)

| Secret | Value |
|---|---|
| `SMTP_USER` | the Gmail address that sends |
| `SMTP_PASS` | the 16-character app password |
| `EMAIL_TO` | both buyers, comma-separated: `you@gmail.com, friend@gmail.com` |
| `SMTP_HOST` | `smtp.gmail.com` (optional, this is the default) |
| `SMTP_PORT` | `587` (optional, this is the default) |
| `EMAIL_FROM` | optional; defaults to `SMTP_USER` |

Any SMTP provider works (Outlook, Fastmail, SendGrid…); just set host/port/user/pass.

### 3. Turn it on

Merge this branch to `main` (scheduled workflows only run from the default
branch). Then **Actions → Tesla inventory monitor → Run workflow** with
*test_email* ticked. Both recipients should get a test message within a minute.

Run it once more with *dry_run* ticked and open the log: you will see how
many cars Tesla returned for each search and how many matched. From then on
it runs itself every 5 minutes.

## Day to day

- **Emails** arrive only for VINs the monitor has not announced before. Each
  one has price, colour, interior, wheels, location, in-transit status and a
  direct order link.
- **Already-announced VINs** are kept in `state/seen.json`, which the workflow
  commits back to the repo. To be re-told about everything currently in stock,
  delete the contents of that file (or run `--reset` locally) and commit.
- **Change the search** by editing `config.json` and committing. Keywords
  match against Tesla's trim name, case-insensitively.
- **Pause** it from Actions → Tesla inventory monitor → "…" → Disable workflow.
- **If a run fails**, GitHub emails you. The most likely cause is Tesla's
  edge returning HTTP 403 to GitHub's servers (see below).

## Running it somewhere else

The script has no dependencies beyond Python 3.10+.

```bash
export SMTP_USER=... SMTP_PASS=... EMAIL_TO="a@x.com, b@y.com"
python3 tools/tesla-monitor/tesla_monitor.py --dry-run      # look, don't mail
python3 tools/tesla-monitor/tesla_monitor.py --test-email   # check mail works
python3 tools/tesla-monitor/tesla_monitor.py --loop 300     # poll every 5 min, forever
```

`--loop` is for an always-on box at home (a Raspberry Pi, an old laptop with
the lid closed and sleep disabled, a $5/month VPS). That is also the fallback
if Tesla blocks GitHub's IP range: Tesla sits behind Akamai, which sometimes
refuses requests from cloud datacentres with HTTP 403 while the same request
from a home connection works. The monitor logs this plainly and the workflow
run goes red so you notice. Nothing in this tool tries to disguise itself to
get around that; if it happens, run it from a residential connection instead.

## Notes

- GitHub's cron minimum is 5 minutes and runs can lag a few minutes under load.
- GitHub disables scheduled workflows on repos with no commits for 60 days;
  the state commits the monitor makes keep it alive while it finds cars, but
  a quiet stretch may need a manual "Run workflow" to re-enable it.
- Tesla's endpoint is the same one the public inventory page uses. It is
  unofficial and can change; `extract_vehicles()` and `describe()` are the two
  places to adjust if the field names move.
