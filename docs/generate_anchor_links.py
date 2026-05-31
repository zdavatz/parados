#!/usr/bin/env python3
"""Generate docs/parados_anchor_links.html (then convert to PDF via LibreOffice).

Reads position/level data LIVE from the game HTML files so the reference never
drifts from the code. URLs are wrapped in explicit <a href> tags — the LibreOffice
writer_pdf filter only emits clickable /URI annotations for real anchor tags.

Regenerate:
    python3 docs/generate_anchor_links.py
    soffice --headless --convert-to pdf:writer_pdf_Export \
        --outdir docs docs/parados_anchor_links.html

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


def dl_table(filename, n_col="#"):
    rows = dl_positions(filename)
    body = "\n".join(
        f"<tr><td>{i}</td><td>{esc(name)}</td><td class='u'>"
        f"{link(BASE + filename + '#' + slug)}</td></tr>"
        for i, (pid, name, slug) in enumerate(rows, 1)
    )
    return (
        "<table><colgroup><col class='c-num'><col class='c-name'>"
        "<col class='c-url'></colgroup>"
        f"<thead><tr><th>{n_col}</th><th>Name</th><th>URL</th></tr></thead>"
        f"<tbody>{body}</tbody></table>"
    )


def kangaroo_table(filename):
    rows = kangaroo_levels(filename)
    body = "\n".join(
        f"<tr><td class='slug'>{esc(slug)}</td><td>{esc(title)}</td>"
        f"<td class='u'>{link(BASE + filename + '#' + slug)}</td></tr>"
        for slug, title in rows
    )
    return (
        "<table><colgroup><col class='c-slug'><col class='c-title'>"
        "<col class='c-url'></colgroup>"
        "<thead><tr><th>Slug</th><th>Title</th><th>URL</th></tr></thead>"
        f"<tbody>{body}</tbody></table>"
    )


def build():
    today = datetime.date.today().isoformat()
    html = f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<title>Parados — Direct-Entry Links</title>
<style>
  @page {{ size: A4 landscape; margin: 1.4cm; }}
  body {{ font-family: 'Helvetica Neue', Arial, sans-serif; color:#111; font-size:10pt; }}
  h1 {{ font-size:18pt; margin:0 0 2px; }}
  h2 {{ font-size:13pt; margin:18px 0 2px; color:#1a5276; border-bottom:2px solid #1a5276; padding-bottom:2px; }}
  h3 {{ font-size:11pt; margin:10px 0 2px; color:#444; }}
  p.lede {{ color:#444; margin:0 0 6px; }}
  p.note {{ color:#555; font-style:italic; margin:4px 0 0; }}
  table {{ border-collapse:collapse; width:100%; margin:4px 0 6px; }}
  col.c-num {{ width:6%; }} col.c-name {{ width:24%; }}
  col.c-slug {{ width:14%; }} col.c-title {{ width:30%; }}
  col.c-url {{ width:70%; }}
  th, td {{ border:1px solid #ccc; padding:3px 6px; text-align:left; vertical-align:top; }}
  th {{ background:#eef3f8; font-size:9pt; }}
  td.u, td.slug {{ font-family:'Courier New', monospace; font-size:8.5pt; }}
  td.u {{ word-break:break-all; }}
  a {{ color:#1558b0; text-decoration:none; }}
  .foot {{ margin-top:14px; font-size:9pt; color:#666; }}
</style></head><body>

<h1>Parados — Direct-Entry Links</h1>
<p class="lede">Click a link to open the game directly at the named starting position. The setup screen is skipped on match.</p>

<h2>Divided Loyalties — German (divided_loyalties.html)</h2>
{dl_table('divided_loyalties.html')}
<p class="note">Numeric shorthand also works: #1 … #12.</p>

<h2>Divided Loyalties — English (divided_loyalties_en.html)</h2>
<p class="note">Same anchors as the German version — position names are stored in English, so a German player can share a link with an English friend without translating the URL.</p>
{dl_table('divided_loyalties_en.html')}
<p class="note">Numeric shorthand also works: #1 … #12.</p>

<h2>The Impatient Kangaroo — DUK (German) / TIK (English) / localized names</h2>
<p class="note">7 levels × 5 language variants. Slugs are identical across languages, so a German player can share a link with an English friend without translating the URL. The DUK acronym is German-only; English is rebranded TIK; JP/CN/UA use the full localized name.</p>

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

<p class="foot">Generated {today} — Parados repo: {link(REPO)}</p>

</body></html>"""
    out = ROOT / "docs" / "parados_anchor_links.html"
    out.write_text(html, encoding="utf-8")
    # quick anchor count sanity check
    n = html.count("<a href")
    print(f"Wrote {out} — {n} hyperlinks (expect 12+12+35+1 = 60).", file=sys.stderr)
    return out


if __name__ == "__main__":
    build()
