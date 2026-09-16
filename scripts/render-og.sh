#!/bin/sh
# Regenerates public/brand/og-1200x630.png from scripts/og-image.html
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if [ ! -x "$CHROME" ]; then
  echo "Google Chrome not found" >&2
  exit 1
fi
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --hide-scrollbars \
  --force-device-scale-factor=1 \
  --window-size=1200,630 \
  --default-background-color=faf8fc \
  --screenshot="$ROOT/public/brand/og-1200x630.png" \
  "file://$ROOT/scripts/og-image.html"
echo "wrote $ROOT/public/brand/og-1200x630.png"
