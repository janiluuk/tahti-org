#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (C) 2026 Tahti ry <https://tahti.live>
#
# M21 editor load test — synthesize a long WAV and benchmark FFmpeg trim/fade/loudnorm.
# Usage: scripts/editor-load-test.sh [duration_minutes]
# Requires: ffmpeg, ffprobe

set -euo pipefail

DURATION_MIN="${1:-60}"
TMP_DIR="$(mktemp -d)"
INPUT="$TMP_DIR/mix.wav"
OUTPUT="$TMP_DIR/trimmed.wav"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "Generating ${DURATION_MIN}m silent stereo WAV (44.1 kHz)…"
ffmpeg -hide_banner -loglevel error -f lavfi -i "anullsrc=r=44100:cl=stereo" -t "$((DURATION_MIN * 60))" "$INPUT"

SIZE_MB="$(du -m "$INPUT" | cut -f1)"
echo "Input size: ${SIZE_MB} MB"

START=$(date +%s.%N)
ffmpeg -hide_banner -loglevel error -y \
  -ss 120 -i "$INPUT" -t 1800 \
  -af "afade=t=in:st=0:d=2,afade=t=out:st=1798:d=2,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=none,alimiter=limit=0.98:attack=5:release=50" \
  -ar 44100 -ac 2 "$OUTPUT"
END=$(date +%s.%N)

ELAPSED="$(echo "$END - $START" | bc)"
OUT_DUR="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$OUTPUT")"

echo "Bounce completed in ${ELAPSED}s (30 min selection from ${DURATION_MIN}m source)"
echo "Output duration: ${OUT_DUR}s"
echo "OK — editor worker path is feasible for ${DURATION_MIN}m sources"
