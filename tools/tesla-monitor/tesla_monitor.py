#!/usr/bin/env python3
"""
Tesla new-inventory monitor.

Polls Tesla's public inventory endpoint for one or more searches (model,
trim, zip, radius), remembers every VIN it has already reported, and emails
a list of recipients the moment a vehicle that matches shows up.

Standard library only. No API keys for Tesla; email goes out over SMTP
(a Gmail "app password" works fine).

Usage
-----
  python3 tesla_monitor.py                 # one pass, then exit (GitHub Actions)
  python3 tesla_monitor.py --loop 300      # poll forever, every 300 s (home machine)
  python3 tesla_monitor.py --dry-run       # search + print, no email, no state change
  python3 tesla_monitor.py --test-email    # send a test email and exit
  python3 tesla_monitor.py --reset         # forget every VIN seen so far

Configuration
-------------
Searches live in config.json next to this file (or pass --config PATH).
Email settings come from environment variables:

  SMTP_HOST      e.g. smtp.gmail.com           (default smtp.gmail.com)
  SMTP_PORT      e.g. 587                      (default 587, STARTTLS)
  SMTP_USER      the mailbox that sends
  SMTP_PASS      its password / app password
  EMAIL_FROM     From: address                 (default SMTP_USER)
  EMAIL_TO       comma-separated recipients    e.g. "you@x.com, buyer@y.com"
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import smtplib
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from email.message import EmailMessage
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_CONFIG = HERE / "config.json"
DEFAULT_STATE = HERE / "state" / "seen.json"

INVENTORY_URL = "https://www.tesla.com/inventory/api/v4/inventory-results"
USER_AGENT = "tesla-inventory-monitor/1.0 (+https://github.com/arjuptl/museum-of-emergence)"


# ───────────────────────────────────────────────────────────────────────────
# Tesla inventory query
# ───────────────────────────────────────────────────────────────────────────

def build_query(search: dict) -> str:
    """Build the JSON `query` parameter Tesla's inventory page sends."""
    options = {}
    if search.get("trim_codes"):
        options["TRIM"] = list(search["trim_codes"])
    q = {
        "query": {
            "model": search.get("model", "my"),
            "condition": search.get("condition", "new"),
            "options": options,
            "arrangeby": "Price",
            "order": "asc",
            "market": search.get("market", "US"),
            "language": "en",
            "super_region": "north america",
            "zip": str(search["zip"]),
            "range": int(search.get("range_miles", 200)),
            "region": search.get("region", ""),
        },
        "offset": 0,
        "count": int(search.get("count", 50)),
        "outsideOffset": 0,
        "outsideSearch": False,
        "isFalconDeliverySelectionEnabled": True,
        "version": "v2",
    }
    return json.dumps(q, separators=(",", ":"))


def fetch_inventory(search: dict, timeout: int = 30) -> list[dict]:
    """Return the raw vehicle records for one search."""
    url = INVENTORY_URL + "?query=" + urllib.parse.quote(build_query(search))
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        payload = json.loads(resp.read().decode("utf-8"))
    return extract_vehicles(payload)


def extract_vehicles(payload: dict) -> list[dict]:
    """Tesla returns either results: [...] or results: {exact: [...], approximate: [...]}."""
    results = payload.get("results", [])
    if isinstance(results, dict):
        vehicles = list(results.get("exact") or []) + list(results.get("approximate") or [])
    else:
        vehicles = list(results or [])
    return [v for v in vehicles if isinstance(v, dict) and v.get("VIN")]


# ───────────────────────────────────────────────────────────────────────────
# Matching and formatting
# ───────────────────────────────────────────────────────────────────────────

def _as_list(value) -> list[str]:
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return [str(x) for x in value]
    return [str(value)]


def trim_name(v: dict) -> str:
    return str(v.get("TrimName") or v.get("TrimCode") or " ".join(_as_list(v.get("TRIM"))))


def matches(v: dict, search: dict) -> bool:
    """A vehicle matches when its trim name contains any `trim_keywords`
    entry and none of the `exclude_keywords` entries (case-insensitive).
    An empty keyword list matches every trim."""
    name = trim_name(v).lower()
    include = [k.lower() for k in search.get("trim_keywords", [])]
    exclude = [k.lower() for k in search.get("exclude_keywords", [])]
    if include and not any(k in name for k in include):
        return False
    if any(k in name for k in exclude):
        return False
    if search.get("max_price") and price_of(v) and price_of(v) > float(search["max_price"]):
        return False
    return True


def price_of(v: dict) -> float | None:
    for key in ("InventoryPrice", "PurchasePrice", "Price", "TotalPrice"):
        try:
            if v.get(key) is not None:
                return float(v[key])
        except (TypeError, ValueError):
            continue
    return None


def vehicle_url(v: dict) -> str:
    vin = v.get("VIN", "")
    model = str(v.get("Model") or "my").lower()
    return f"https://www.tesla.com/{model}/order/{vin}?titleStatus=new&redirect=no#overview"


def describe(v: dict) -> str:
    price = price_of(v)
    price_s = f"${price:,.0f}" if price else "price n/a"
    paint = ", ".join(_as_list(v.get("PAINT"))) or "paint n/a"
    interior = ", ".join(_as_list(v.get("INTERIOR"))) or "interior n/a"
    wheels = ", ".join(_as_list(v.get("WHEELS"))) or "wheels n/a"
    where = ", ".join(x for x in (v.get("City"), v.get("StateProvince")) if x) or "location n/a"
    vrl = v.get("VrlName") or ""
    if vrl and vrl not in where:
        where = f"{vrl} ({where})"
    status = []
    if v.get("InTransit"):
        status.append("in transit")
    if v.get("IsAtLocation"):
        status.append("at location")
    if v.get("IsDemo"):
        status.append("demo")
    odo = v.get("Odometer")
    if odo not in (None, "", 0, "0"):
        status.append(f"{odo} mi")
    status_s = " · ".join(status) if status else "status n/a"
    return (
        f"{v.get('Year', '')} {str(v.get('Model', 'MY')).upper()} {trim_name(v)} — {price_s}\n"
        f"  {paint} / {interior} / {wheels}\n"
        f"  {where} — {status_s}\n"
        f"  VIN {v.get('VIN')}\n"
        f"  {vehicle_url(v)}"
    )


# ───────────────────────────────────────────────────────────────────────────
# State
# ───────────────────────────────────────────────────────────────────────────

def load_state(path: Path) -> dict:
    try:
        return json.loads(path.read_text("utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {"seen": {}}


def save_state(path: Path, state: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True) + "\n", "utf-8")


# ───────────────────────────────────────────────────────────────────────────
# Email
# ───────────────────────────────────────────────────────────────────────────

def email_settings() -> dict:
    to = [a.strip() for a in os.environ.get("EMAIL_TO", "").split(",") if a.strip()]
    s = {
        "host": os.environ.get("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER", ""),
        "password": os.environ.get("SMTP_PASS", ""),
        "from": os.environ.get("EMAIL_FROM") or os.environ.get("SMTP_USER", ""),
        "to": to,
    }
    missing = [k for k in ("user", "password", "from") if not s[k]]
    if not to:
        missing.append("EMAIL_TO")
    if missing:
        raise SystemExit(f"email not configured; missing: {', '.join(missing)} "
                         "(set SMTP_USER, SMTP_PASS, EMAIL_TO)")
    return s


def send_email(subject: str, body: str) -> None:
    s = email_settings()
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = s["from"]
    msg["To"] = ", ".join(s["to"])
    msg.set_content(body)
    ctx = ssl.create_default_context()
    if s["port"] == 465:
        with smtplib.SMTP_SSL(s["host"], s["port"], context=ctx, timeout=30) as smtp:
            smtp.login(s["user"], s["password"])
            smtp.send_message(msg)
    else:
        with smtplib.SMTP(s["host"], s["port"], timeout=30) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ctx)
            smtp.login(s["user"], s["password"])
            smtp.send_message(msg)
    log(f"emailed {len(s['to'])} recipient(s): {subject}")


# ───────────────────────────────────────────────────────────────────────────
# Main loop
# ───────────────────────────────────────────────────────────────────────────

def log(msg: str) -> None:
    stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%d %H:%M:%SZ")
    print(f"[{stamp}] {msg}", flush=True)


def run_once(config: dict, state: dict, *, dry_run: bool) -> tuple[list[tuple[dict, dict]], bool]:
    """Run every search. Returns (new matches, had_error)."""
    seen: dict = state.setdefault("seen", {})
    new: list[tuple[dict, dict]] = []
    had_error = False

    for search in config["searches"]:
        label = search.get("label", f"{search.get('model', 'my')} near {search.get('zip')}")
        try:
            vehicles = fetch_inventory(search)
        except urllib.error.HTTPError as e:
            had_error = True
            log(f"{label}: HTTP {e.code} from Tesla ({e.reason}). "
                "A 403 usually means Tesla's edge blocked this network, not a bug.")
            continue
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as e:
            had_error = True
            log(f"{label}: request failed: {e}")
            continue

        hits = [v for v in vehicles if matches(v, search)]
        log(f"{label}: {len(vehicles)} vehicle(s) returned, {len(hits)} match")
        for v in hits:
            vin = v["VIN"]
            if vin in seen:
                continue
            new.append((search, v))
            if not dry_run:
                seen[vin] = {
                    "first_seen": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                    "search": label,
                    "trim": trim_name(v),
                    "price": price_of(v),
                }
    return new, had_error


def notify(new: list[tuple[dict, dict]]) -> None:
    by_search: dict[str, list[dict]] = {}
    for search, v in new:
        by_search.setdefault(search.get("label", "search"), []).append(v)

    n = len(new)
    subject = f"🚗 {n} new Tesla{'s' if n != 1 else ''} in inventory: " + "; ".join(
        f"{len(vs)} × {label}" for label, vs in by_search.items()
    )
    parts = [
        f"Found {n} new matching vehicle{'s' if n != 1 else ''} at "
        f"{dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}.",
        "Inventory cars go fast; open the link and place the order deposit to hold one.",
        "",
    ]
    for label, vs in by_search.items():
        parts.append(f"=== {label} ===")
        for v in vs:
            parts.append(describe(v))
            parts.append("")
    parts.append("— tesla_monitor.py")
    send_email(subject, "\n".join(parts))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    ap.add_argument("--state", type=Path, default=DEFAULT_STATE)
    ap.add_argument("--loop", type=int, metavar="SECONDS", help="poll forever at this interval")
    ap.add_argument("--dry-run", action="store_true", help="search and print; no email, no state change")
    ap.add_argument("--test-email", action="store_true", help="send a test email and exit")
    ap.add_argument("--reset", action="store_true", help="clear the seen-VIN state and exit")
    args = ap.parse_args(argv)

    if args.reset:
        save_state(args.state, {"seen": {}})
        log(f"state reset: {args.state}")
        return 0

    if args.test_email:
        send_email("Tesla inventory monitor: test email",
                   "If you can read this, the monitor can reach you.\n\n— tesla_monitor.py")
        return 0

    config = json.loads(args.config.read_text("utf-8"))
    if not config.get("searches"):
        raise SystemExit(f"no searches defined in {args.config}")
    if not args.dry_run:
        email_settings()  # fail fast on a bad email setup, before polling

    while True:
        state = load_state(args.state)
        new, had_error = run_once(config, state, dry_run=args.dry_run)

        if new:
            log(f"{len(new)} new match(es)")
            for _, v in new:
                print(describe(v) + "\n")
            if not args.dry_run:
                try:
                    notify(new)
                except Exception as e:  # noqa: BLE001 — keep polling even if mail fails
                    log(f"email failed: {e}")
                    had_error = True
                    # do not record VINs we could not announce
                    for _, v in new:
                        state["seen"].pop(v["VIN"], None)
                save_state(args.state, state)
        else:
            log("nothing new")

        if not args.loop:
            return 1 if had_error else 0
        time.sleep(max(60, args.loop))


if __name__ == "__main__":
    sys.exit(main())
