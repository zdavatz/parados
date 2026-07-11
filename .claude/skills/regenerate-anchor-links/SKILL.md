---
name: regenerate-anchor-links
description: Regenerate docs/parados_anchor_links.pdf (the direct-entry URL reference for all games). Use when position names, level titles, or game branding change, or when asked to rebuild/update the anchor-links PDF.
---

# Regenerate the anchor-links PDF

`docs/parados_anchor_links.pdf` lists every direct-entry URL across all games with clickable hyperlinks (60 anchors total: 12 DL-DE + 12 DL-EN + 7×5 kangaroo + repo link — DL has 12 starting positions as of 2026-05-16: a 4-round set (ids 1–6) + a 3-round set (ids 7–12)).

**Regenerate via `docs/generate_anchor_links.py`** (Walter, 2026-05-31): it reads position names + level titles **live** from the game HTML (DL embedded CSV + kangaroo `LEVEL_DATABASE`), so renames/branding never drift.

## Steps

1. Run the generator (emits `docs/parados_anchor_links.html`):
   ```
   python3 docs/generate_anchor_links.py
   ```
   The script prints a hyperlink count — it **must be 60**.

2. Render the emitted HTML to PDF with **Chromium** (honors the CSS exactly + emits clickable link annotations):
   ```
   chromium --headless --no-sandbox --no-pdf-header-footer --print-to-pdf=docs/parados_anchor_links.pdf "file://$(pwd)/docs/parados_anchor_links.html"
   ```

## Notes

- Layout: A4 landscape, every table shares one fixed `table-layout` grid (key 11% / label 31% / URL 58%) so columns line up vertically across all pages; header bands + zebra striping.
- URLs are `<a href>` tags (required for clickable `/URI` annotations).
- **LibreOffice** (`soffice --convert-to pdf:writer_pdf_Export`) still works as a fallback but renders as a loose Writer/Web doc and ignores most styling.
- Both the generator and the intermediate `parados_anchor_links.html` are checked in.
