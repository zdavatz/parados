#!/usr/bin/env python3
"""Generate docs/parados_anchor_links.html (then convert to PDF via LibreOffice).

Reads position/level data LIVE from the game HTML files so the reference never
drifts from the code. URLs are wrapped in explicit <a href> tags — the LibreOffice
writer_pdf filter only emits clickable /URI annotations for real anchor tags.

Regenerate:
    python3 docs/generate_anchor_links.py
    chromium --headless --no-sandbox --no-pdf-header-footer \
        --print-to-pdf=docs/parados_anchor_links.pdf \
        file://$(pwd)/docs/parados_anchor_links.html

Chromium's print-to-pdf honors the CSS exactly (fixed table-layout, landscape
@page, zebra striping) and emits clickable link annotations for <a href> tags.
LibreOffice (writer_pdf_Export) also works but renders as a Writer/Web doc with
loose row spacing and ignores most of the styling.

Anchors: 12 DL-DE + 12 DL-EN + 7×5 kangaroo + repo link.
"""
import re
import sys
import unicodedata
import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BASE = "https://game.ywesee.com/parados/"
REPO = "https://github.com/zdavatz/parados"


def slugify(s):
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def dl_positions(filename):
    """Unique (id, name, slug) from the embedded DL position CSV."""
    html = (ROOT / filename).read_text(encoding="utf-8")
    m = re.search(r"EMBEDDED_POSITIONS_CSV = `(.*?)`", html, re.S)
    rows = m.group(1).strip().splitlines()
    seen, out = set(), []
    for line in rows[1:]:
        parts = line.split(",")
        if len(parts) < 3:
            continue
        pid, name = parts[0], parts[1]
        if pid in seen:
            continue
        seen.add(pid)
        out.append((pid, name, slugify(name)))
    return out


def kangaroo_levels(filename):
    """(slug, title) pairs from LEVEL_DATABASE, in declaration order, deduped by slug."""
    html = (ROOT / filename).read_text(encoding="utf-8")
    seen, out = set(), []
    for m in re.finditer(
        r"id:\s*'([a-z0-9-]+)'.*?name:\s*'([^']*)'", html, re.S
    ):
        slug, title = m.group(1), m.group(2)
        if slug in seen:
            continue
        seen.add(slug)
        out.append((slug, title))
        if len(out) == 7:
            break
    return out


def esc(s):
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def link(url):
    return f'<a href="{esc(url)}">{esc(url)}</a>'


# Every table shares one fixed column grid so the columns line up vertically
# across all pages (key=11% / label=31% / URL=58%).
COLGROUP = (
    "<colgroup><col class='c-key'><col class='c-label'><col class='c-url'></colgroup>"
)


def dl_table(filename):
    rows = dl_positions(filename)
    body = "\n".join(
        f"<tr><td class='key'>{i}</td><td>{esc(name)}</td><td class='u'>"
        f"{link(BASE + filename + '#' + slug)}</td></tr>"
        for i, (pid, name, slug) in enumerate(rows, 1)
    )
    return (
        f"<table>{COLGROUP}"
        "<thead><tr><th>#</th><th>Name</th><th>URL</th></tr></thead>"
        f"<tbody>{body}</tbody></table>"
    )


def kangaroo_table(filename):
    rows = kangaroo_levels(filename)
    body = "\n".join(
        f"<tr><td class='key mono'>{esc(slug)}</td><td>{esc(title)}</td>"
        f"<td class='u'>{link(BASE + filename + '#' + slug)}</td></tr>"
        for slug, title in rows
    )
    return (
        f"<table>{COLGROUP}"
        "<thead><tr><th>Slug</th><th>Title</th><th>URL</th></tr></thead>"
        f"<tbody>{body}</tbody></table>"
    )


def build():
    today = datetime.date.today().isoformat()
    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Parados — Direct-Entry Links</title>
<style>
  @page {{
    size: A4 landscape; margin: 14mm 16mm;
  }}
  * {{ box-sizing: border-box; }}
  html {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  body {{
    font-family: 'Helvetica Neue', 'Segoe UI', 'Noto Sans', Arial, sans-serif;
    color:#1b2430; font-size:9.5pt; line-height:1.35; margin:0;
  }}
  h1 {{ font-size:21pt; font-weight:700; letter-spacing:-0.3px; margin:0 0 2px; color:#0f1b2d; }}
  .lede {{ color:#5a6b7b; margin:0 0 2px; font-size:10pt; }}
  .rule {{ height:3px; background:linear-gradient(90deg,#1a5276,#48a0c9); border-radius:2px; margin:8px 0 4px; }}

  h2 {{
    font-size:12.5pt; font-weight:700; margin:16px 0 6px; color:#0f1b2d;
    border-left:5px solid #1a5276; padding:2px 0 2px 9px;
  }}
  h3 {{ font-size:10.5pt; font-weight:600; margin:11px 0 3px; color:#1a5276; }}
  p.note {{ color:#6a7886; font-size:8.7pt; margin:3px 0 5px; }}

  table {{
    border-collapse:collapse; width:100%; table-layout:fixed; margin:3px 0 4px;
  }}
  /* Shared grid → columns line up vertically across every table/page */
  col.c-key {{ width:11%; }}
  col.c-label {{ width:31%; }}
  col.c-url {{ width:58%; }}
  thead {{ display:table-header-group; }}     /* repeat header on page breaks */
  tr {{ break-inside:avoid; }}
  th {{
    background:#1a5276; color:#fff; font-size:8.5pt; font-weight:600;
    text-align:left; padding:5px 9px; letter-spacing:0.3px;
  }}
  th:first-child {{ border-top-left-radius:4px; }}
  th:last-child {{ border-top-right-radius:4px; }}
  td {{ padding:4px 9px; vertical-align:middle; border-bottom:1px solid #e4e9ee; }}
  tbody tr:nth-child(even) {{ background:#f4f7fa; }}
  td.key {{ color:#34495e; font-weight:600; }}
  td.mono {{ font-family:'SF Mono','Consolas','Courier New',monospace; font-size:8.4pt; color:#1a5276; }}
  td.u {{ font-family:'SF Mono','Consolas','Courier New',monospace; font-size:8.2pt; word-break:break-all; }}
  a {{ color:#1558b0; text-decoration:none; }}

  .foot {{ margin-top:16px; padding-top:7px; border-top:1px solid #d7dee4; font-size:8.5pt; color:#7a8794; }}
</style></head><body>

<h1>Parados — Direct-Entry Links</h1>
<p class="lede">Click any link to open the game directly at the named starting position — the setup screen is skipped on match.</p>
<div class="rule"></div>

<h2>Divided Loyalties — German <span style="font-weight:400;color:#6a7886;">(divided_loyalties.html)</span></h2>
{dl_table('divided_loyalties.html')}
<p class="note">Numeric shorthand also works: #1 … #12.</p>

<h2>Divided Loyalties — English <span style="font-weight:400;color:#6a7886;">(divided_loyalties_en.html)</span></h2>
<p class="note">Same anchors as the German version — position names are stored in English, so a German player can share a link with an English-speaking friend without translating the URL.</p>
{dl_table('divided_loyalties_en.html')}
<p class="note">Numeric shorthand also works: #1 … #12.</p>

<h2>The Impatient Kangaroo <span style="font-weight:400;color:#6a7886;">— DUK (DE) · TIK (EN) · localized names</span></h2>
<p class="note">7 levels × 5 language variants. Slugs are identical across languages, so a link shares cleanly between players of different languages. The DUK acronym is German-only; English is rebranded TIK; JP/CN/UA use the full localized name.</p>

<h3>German — DUK (kangaroo.html)</h3>
{kangaroo_table('kangaroo.html')}

<h3>English — TIK (kangaroo_en.html)</h3>
{kangaroo_table('kangaroo_en.html')}

<h3>Japanese (kangaroo_jp.html)</h3>
{kangaroo_table('kangaroo_jp.html')}

<h3>Chinese (kangaroo_cn.html)</h3>
{kangaroo_table('kangaroo_cn.html')}

<h3>Ukrainian (kangaroo_ua.html)</h3>
{kangaroo_table('kangaroo_ua.html')}

<p class="note">Shorthand &amp; variants for kangaroo: numeric #1 … #7 (index in LEVEL_DATABASE) works too. Levels with two starting positions accept a trailing <b>b</b> for variant B: #first-stepsb, #the-blockb, #shiftingb, #the-crossb.</p>

<p class="foot">Generated {today} &nbsp;·&nbsp; Parados repo: {link(REPO)}</p>

</body></html>"""
    out = ROOT / "docs" / "parados_anchor_links.html"
    out.write_text(html, encoding="utf-8")
    # quick anchor count sanity check
    n = html.count("<a href")
    print(f"Wrote {out} — {n} hyperlinks (expect 12+12+35+1 = 60).", file=sys.stderr)
    return out


if __name__ == "__main__":
    build()
