# rules_pdf — one rules PDF per game

Generates `docs/rules/<game>_rules.pdf` for every game HTML file in the repo
root (20 files: every game × every language variant, remote variants
included). Each PDF starts with a links box — the game's web URL plus the
Parados app-store links (iOS/Mac, Android, Windows) — followed by the full
rules text extracted from that file's rules modal, in that file's language.

## Usage

```sh
cd tools/rules_pdf
./prepare.sh          # once per checkout: fonts + patched azul-layout vendor
cargo run --release   # writes ../../docs/rules/*.pdf
```

`prepare.sh` needs `curl` and [`uv`](https://docs.astral.sh/uv/) (for
fonttools). It fills the gitignored `fonts/` and `vendor/` directories.

Re-run `cargo run --release` after any change to a game's rules modal.
Additionally re-run `./prepare.sh` after deleting `fonts/NotoSans*-Subset.ttf`
if new Japanese/Chinese characters were added to `*_jp.html` / `*_cn.html` —
the CJK fonts are subset at prepare time to the characters those files use
(the tool fails loudly if a glyph is missing, so you can't ship tofu).

## How it works

- Per game file: `scraper` parses the HTML, the rules modal (`#rulesModal`,
  `#rules-modal`, `.rules-text` or `#modal`) is sanitized down to
  headings/paragraphs/lists/bold/italic, `[cite…]` artifacts and emoji are
  stripped, and a small HTML template (links box + rules) is rendered to PDF
  with `printpdf`'s HTML renderer. Fonts: Noto Sans (Latin+Cyrillic),
  Noto Sans JP, Noto Sans SC — picked per `<html lang>`.
- Each PDF ends with a localized "All game rules as PDF" index on its last
  page: a link to the GitHub `docs/rules/` folder plus one entry per sibling
  PDF (GitHub blob links, the current game excluded). Labels are ASCII
  ("Divided Loyalties (JP)", …) so every entry renders in every font.
- All links (header URLs + index entries) are blue + underlined and
  **clickable**: azul's HTML renderer emits no link annotations, so
  `annotate_links()` finds link text on every page by its fill color
  (`#0645ad` — only links use it), computes each line's rectangle from the
  rendered glyph positions, and attaches a PDF `LinkAnnotation` per line.
  The run fails if the count of blue lines doesn't match the count of URLs.
- Every PDF is then verified: each glyph referenced by a content stream must
  have a non-empty outline in the embedded font, and every expected character
  must resolve to a non-empty glyph through the embedded font's cmap.
  The run fails if anything is off.

## Workarounds this tool carries (printpdf 0.10 / azul-layout 0.0.9)

Documented here because every one of them was found the hard way:

1. **azul-layout 0.0.9 segfaults on any native target** — it ships leftover
   "M12.7 diag" instrumentation: 48 unconditional `write_volatile()`s to the
   magic addresses `0x400A4–0x400EC`. `prepare.sh` vendors the crate into
   `vendor/azul-layout` and strips those calls; `Cargo.toml` has a
   `[patch.crates-io]` pointing there. (Mapping a page at `0x40000` instead
   does not work on macOS arm64 — the kernel SIGKILLs arm64 binaries whose
   `__PAGEZERO` is smaller than 4 GB.)
2. **Inline `<b>`/`<strong>`/`<em>`/`<i>` drop their text** in azul's
   layouter. `<span style="font-weight: bold">` renders fine, so the
   sanitizer only ever emits styled spans.
3. **printpdf's font subsetter maps glyphs it lost to `.notdef`**:
   - Glyphs produced by OpenType layout features (fi/fl ligatures) — so the
     Latin fonts used here have all layout features stripped
     (`*-noliga.ttf`), which keeps printpdf's (otherwise correct) subsetting.
   - Various glyphs of the big CJK fonts (digits rendered blank) — so the
     CJK fonts are pre-subset with fonttools at prepare time and embedded
     whole (`subset_fonts: false`).
4. **The font matcher is fuzzy across families** ("Noto Sans" can match
   "Noto Sans JP"), so each script gets its own font pool with only its own
   fonts.
5. **google/fonts ships Noto Sans JP/SC only as variable TTFs whose default
   instance is Thin** (`wght` min=100 is the default) — `prepare.sh`
   instances them to a static Regular with fonttools.

`src/bin/verify.rs` runs the glyph verifier on any PDF:
`cargo run --release --bin verify -- path/to/file.pdf`.
