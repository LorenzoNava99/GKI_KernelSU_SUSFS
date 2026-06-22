#!/usr/bin/env bash
# Rebuilds the WebGPU stack bundle (three.webgpu + tsl + post addons) into one
# classic IIFE script that the WebView loads over file:// without ES modules.
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
"$DIR/node_modules/.bin/esbuild" "$DIR/entry.js" --bundle --format=iife --minify \
  --legal-comments=none --outfile="$DIR/../../app/assets/lib/moto-three.bundle.js"
echo "bundle: $(wc -c < "$DIR/../../app/assets/lib/moto-three.bundle.js") bytes"
