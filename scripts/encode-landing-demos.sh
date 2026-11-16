#!/usr/bin/env bash
# Turns raw Playwright recordings into web assets: <scene>.webm (VP9), .mp4 (H.264 for
# Safari) and a .jpg poster. Defaults are the landing demos; for «Что нового» clips:
#   RAW=.landing-demos/changelog OUT=public/changelog/0.5 WEBM_ONLY=1 scripts/encode-landing-demos.sh
set -euo pipefail

RAW=${RAW:-.landing-demos/raw}
OUT=${OUT:-public/landing/demo}
TRIM_START=${TRIM_START:-0.8}
mkdir -p "$OUT"

for src in "$RAW"/*.webm; do
  name=$(basename "$src" .webm)
  ffmpeg -v error -y -ss "$TRIM_START" -i "$src" -vf "scale=1440:-2,fps=30" -an \
    -c:v libvpx-vp9 -crf 38 -b:v 0 -row-mt 1 -deadline good "$OUT/$name.webm"
  if [ -n "${WEBM_ONLY:-}" ]; then echo "$name: $(du -h "$OUT/$name.webm" | cut -f1) webm"; continue; fi
  ffmpeg -v error -y -ss "$TRIM_START" -i "$src" -vf "scale=1440:-2,fps=30" -an \
    -c:v libx264 -crf 27 -preset slow -pix_fmt yuv420p -movflags +faststart "$OUT/$name.mp4"
  ffmpeg -v error -y -ss 1 -i "$OUT/$name.mp4" -frames:v 1 -q:v 3 "$OUT/$name.jpg"
  echo "$name: $(du -h "$OUT/$name.webm" | cut -f1) webm, $(du -h "$OUT/$name.mp4" | cut -f1) mp4"
done
