#!/usr/bin/env bash
# Rebuild the printable safety templates and abbreviation list.
# Needs Node with the `docx` package, LibreOffice (soffice) and poppler (pdfunite).
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_PATH="$(npm root -g)" node tools/build-printables.js

rm -rf templates/pdf && mkdir -p templates/pdf
soffice --headless --convert-to pdf --outdir templates/pdf templates/word/*.docx >/dev/null 2>&1

# One combined PDF of all safety templates for printing a site pack
pdfunite $(ls templates/pdf/*.pdf | grep -v '^templates/pdf/00_') templates/pdf/00_All-Safety-Templates.pdf
echo "PDFs written to templates/pdf"
