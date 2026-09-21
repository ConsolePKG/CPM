#!/bin/bash
set -euo pipefail

# macOS provides sips and iconutil; generated assets are committed for all hosts.
desktop_dir="$(cd "$(dirname "$0")/.." && pwd)"
source_svg="$desktop_dir/../web/src/assets/icon.svg"
temp_dir="$(mktemp -d)"
trap 'rm -rf "$temp_dir"' EXIT
iconset="$temp_dir/icon.iconset"
mkdir -p "$iconset"

# The supplied artwork has a rounded 896px tile and 64px transparent margins
# on a 1024px canvas. Preserve its silhouette instead of cropping or masking it.
sips -s format png -z 1024 1024 "$source_svg" --out "$desktop_dir/assets/icon.png" >/dev/null
for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$desktop_dir/assets/icon.png" --out "$iconset/icon_${size}x${size}.png" >/dev/null
  retina_size=$((size * 2))
  sips -z "$retina_size" "$retina_size" "$desktop_dir/assets/icon.png" --out "$iconset/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$iconset" -o "$desktop_dir/assets/icon.icns"
