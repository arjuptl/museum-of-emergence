#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────────────────
# Backup for The Museum of Emergence.
#
# Writes two independent artefacts OUTSIDE the project folder, so that
# deleting the project (or the GitHub repo) loses nothing:
#
#   <stamp>-museum.tar.gz    the working tree, restorable with plain tar
#   <stamp>-museum.bundle    the entire git history in one file, clonable
#
# Together with the GitHub remote that is three independent copies.
#
#   ./tools/backup.sh                 # default location
#   MUSEUM_BACKUP_DIR=/some/path ./tools/backup.sh
# ────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "$0")/.." || exit 1
PROJECT="$(pwd)"

DEST="${MUSEUM_BACKUP_DIR:-$HOME/museum-backups}"
KEEP="${MUSEUM_BACKUP_KEEP:-12}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"

echo
echo "  Backing up  $PROJECT"
echo "          to  $DEST"
echo

# 1 ── working tree
tar --exclude='.git' --exclude='_backups' --exclude='.DS_Store' \
    -czf "$DEST/$STAMP-museum.tar.gz" -C "$(dirname "$PROJECT")" "$(basename "$PROJECT")"
echo "  ✓ tree     $STAMP-museum.tar.gz  ($(du -h "$DEST/$STAMP-museum.tar.gz" | cut -f1 | tr -d ' '))"

# 2 ── complete git history, clonable on its own
if git rev-parse --git-dir >/dev/null 2>&1 && git rev-parse HEAD >/dev/null 2>&1; then
  git bundle create "$DEST/$STAMP-museum.bundle" --all >/dev/null 2>&1
  echo "  ✓ history  $STAMP-museum.bundle  ($(du -h "$DEST/$STAMP-museum.bundle" | cut -f1 | tr -d ' '))"
else
  echo "  ! no commits yet — skipped the git bundle"
fi

# 3 ── checksums, so a corrupted backup is detectable rather than silent
( cd "$DEST" && shasum -a 256 "$STAMP-museum.tar.gz" \
   $( [ -f "$STAMP-museum.bundle" ] && echo "$STAMP-museum.bundle" ) \
   > "$STAMP-museum.sha256" )
echo "  ✓ checksums $STAMP-museum.sha256"

# 4 ── prune, keeping the most recent $KEEP of each kind
for ext in tar.gz bundle sha256; do
  ls -1t "$DEST"/*-museum."$ext" 2>/dev/null | tail -n +$((KEEP+1)) | while read -r old; do
    rm -f "$old"; echo "  · pruned $(basename "$old")"
  done
done

cat <<TXT

  Restore
  ───────
  From the tarball:
      tar -xzf $DEST/$STAMP-museum.tar.gz -C /where/you/want

  From the bundle (brings the full history back):
      git clone $DEST/$STAMP-museum.bundle museum-of-emergence

  Verify a backup before trusting it:
      cd $DEST && shasum -a 256 -c $STAMP-museum.sha256

  Copies now held: $(ls -1 "$DEST"/*-museum.tar.gz 2>/dev/null | wc -l | tr -d ' ') local, plus the GitHub remote.

TXT
