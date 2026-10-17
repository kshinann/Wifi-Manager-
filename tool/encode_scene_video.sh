#!/usr/bin/env bash
# Converts any clip into the format every scene video uses, so it plays on
# mid-range Android phones: 720x1280 portrait, H.264 Main 3.1, 30 fps, no
# audio, at most 20 s, fast-start MP4.
#
#   tool/encode_scene_video.sh input.mp4 output.mp4          # crop to fill
#   tool/encode_scene_video.sh input.mp4 output.mp4 --fit    # whole frame over a blurred fill
#
# Requires ffmpeg.
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: $0 input output.mp4 [--fit]" >&2
  exit 1
fi
in=$1
out=$2
mode=${3:-}

enc=(-c:v libx264 -profile:v main -level 3.1 -pix_fmt yuv420p -preset slow
     -crf 24 -maxrate 2500k -bufsize 5000k -movflags +faststart -an -r 30)

if [[ $mode == --fit ]]; then
  ffmpeg -y -i "$in" -t 20 -filter_complex \
    "[0:v]scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,boxblur=24:3,eq=brightness=-0.08[bg];\
[0:v]scale=720:-2:flags=lanczos,unsharp=5:5:0.6[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,fps=30" \
    "${enc[@]}" "$out"
else
  ffmpeg -y -i "$in" -t 20 \
    -vf "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=30" \
    "${enc[@]}" "$out"
fi
