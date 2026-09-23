#!/bin/bash
# Assemble the single-file page from src/
set -e
cd "$(dirname "$0")"
mkdir -p dist
{
  cat src/shell_head.html
  echo '<style>'; cat src/style.css; echo '</style>'
  cat src/shell_body.html
  echo '<script>'
  for f in lib ui app m2a m2b m3a m3b; do cat "src/$f.js"; echo; done
  echo 'APP.start();'
  echo '</script>'
} > dist/cv-lab.html
# GitHub Pages copy: full document
mkdir -p docs
{
  echo '<!doctype html><html lang="ko"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">'
  sed -n '1,/<\/style>/p' dist/cv-lab.html
  echo '</head><body>'
  sed -n '/<\/style>/,$p' dist/cv-lab.html | tail -n +2
  echo '</body></html>'
} > docs/index.html
echo "built dist/cv-lab.html ($(wc -c < dist/cv-lab.html) bytes)"
