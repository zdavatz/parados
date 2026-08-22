#!/bin/sh
# One-time setup for the rules_pdf tool: fetches fonts and vendors a patched
# azul-layout. Everything lands in fonts/ and vendor/ (both gitignored).
#
# Needs: curl, tar, perl, and `uv` (https://docs.astral.sh/uv/) for fonttools.
set -eu
cd "$(dirname "$0")"

mkdir -p fonts vendor

# ---------------------------------------------------------------- Latin fonts
# Noto Sans (Latin + Greek + Cyrillic), hinted static TTFs.
NOTO_BASE="https://github.com/notofonts/notofonts.github.io/raw/main/fonts/NotoSans/hinted/ttf"
for w in Regular Bold; do
    [ -f "fonts/NotoSans-$w.ttf" ] || curl -sL -o "fonts/NotoSans-$w.ttf" "$NOTO_BASE/NotoSans-$w.ttf"
    # printpdf 0.10's font subsetter maps glyphs produced by OpenType layout
    # features (fi/fl ligatures, …) to .notdef, so they render blank. Strip
    # all layout features: azul then never forms ligatures and every glyph
    # the layouter emits comes straight from the cmap, which printpdf
    # subsets correctly.
    [ -f "fonts/NotoSans-$w-noliga.ttf" ] || uv run --with fonttools -- pyftsubset \
        "fonts/NotoSans-$w.ttf" --unicodes='*' --layout-features='' --name-IDs='*' \
        --output-file="fonts/NotoSans-$w-noliga.ttf"
done

# ------------------------------------------------------------------ CJK fonts
# google/fonts only ships Noto Sans JP/SC as variable TTFs whose DEFAULT
# instance is Thin (wght min=100) — instance them to a static Regular.
# printpdf's subsetter corrupts glyphs of these big fonts (digits render
# blank), so main.rs embeds them whole with printpdf subsetting disabled;
# to keep the PDFs small they are pre-subset here to the characters actually
# used by the JP/CN game files (plus Latin, punctuation, kana and fullwidth
# blocks). After editing rules text in a _jp/_cn game file, re-run this
# script — main.rs fails loudly if a needed glyph is missing.
GF_BASE="https://github.com/google/fonts/raw/main/ofl"
UNICODES="U+0020-00FF,U+2000-206F,U+3000-30FF,U+FF00-FFEF"

if [ ! -f fonts/NotoSansJP-Subset.ttf ]; then
    curl -sL -o fonts/NotoSansJP-VF.ttf "$GF_BASE/notosansjp/NotoSansJP%5Bwght%5D.ttf"
    uv run --with fonttools -- fonttools varLib.instancer --update-name-table \
        -o fonts/NotoSansJP-Regular.ttf fonts/NotoSansJP-VF.ttf wght=400
    rm fonts/NotoSansJP-VF.ttf
    cat ../../*_jp.html src/main.rs > fonts/jp_chars.txt
    uv run --with fonttools -- pyftsubset fonts/NotoSansJP-Regular.ttf \
        --text-file=fonts/jp_chars.txt --unicodes="$UNICODES" \
        --layout-features='*' --name-IDs='*' --output-file=fonts/NotoSansJP-Subset.ttf
    rm fonts/jp_chars.txt
fi

if [ ! -f fonts/NotoSansSC-Subset.ttf ]; then
    curl -sL -o fonts/NotoSansSC-VF.ttf "$GF_BASE/notosanssc/NotoSansSC%5Bwght%5D.ttf"
    uv run --with fonttools -- fonttools varLib.instancer --update-name-table \
        -o fonts/NotoSansSC-Regular.ttf fonts/NotoSansSC-VF.ttf wght=400
    rm fonts/NotoSansSC-VF.ttf
    cat ../../*_cn.html src/main.rs > fonts/cn_chars.txt
    uv run --with fonttools -- pyftsubset fonts/NotoSansSC-Regular.ttf \
        --text-file=fonts/cn_chars.txt --unicodes="$UNICODES" \
        --layout-features='*' --name-IDs='*' --output-file=fonts/NotoSansSC-Subset.ttf
    rm fonts/cn_chars.txt
fi

# Korean: Noto Sans KR (Hangul). Same variable-font → static Regular → subset
# pipeline as JP/SC; the actual Hangul syllables come from the *_ko.html files
# via --text-file, plus the jamo blocks for safety.
if [ ! -f fonts/NotoSansKR-Subset.ttf ]; then
    curl -sL -o fonts/NotoSansKR-VF.ttf "$GF_BASE/notosanskr/NotoSansKR%5Bwght%5D.ttf"
    uv run --with fonttools -- fonttools varLib.instancer --update-name-table \
        -o fonts/NotoSansKR-Regular.ttf fonts/NotoSansKR-VF.ttf wght=400
    rm fonts/NotoSansKR-VF.ttf
    cat ../../*_ko.html src/main.rs > fonts/ko_chars.txt
    uv run --with fonttools -- pyftsubset fonts/NotoSansKR-Regular.ttf \
        --text-file=fonts/ko_chars.txt --unicodes="$UNICODES,U+1100-11FF,U+3130-318F" \
        --layout-features='*' --name-IDs='*' --output-file=fonts/NotoSansKR-Subset.ttf
    rm fonts/ko_chars.txt
fi

# ------------------------------------------------- patched azul-layout vendor
# azul-layout 0.0.9 (printpdf 0.10's HTML layout engine) ships leftover
# "M12.7 diag" instrumentation: 48 unconditional write_volatile()s to the
# magic addresses 0x400A4-0x400EC. On any native target those hit unmapped
# memory and segfault instantly (macOS arm64 refuses binaries with a small
# __PAGEZERO, so the page cannot be mapped either). Vendor the crate and
# strip the calls; Cargo.toml's [patch.crates-io] points here.
if [ ! -d vendor/azul-layout ]; then
    curl -sL -o vendor/azul-layout.crate "https://static.crates.io/crates/azul-layout/azul-layout-0.0.9.crate"
    tar xzf vendor/azul-layout.crate -C vendor
    mv vendor/azul-layout-0.0.9 vendor/azul-layout
    rm vendor/azul-layout.crate
    perl -0777 -pi -e 's/unsafe\s*\{\s*core::ptr::write_volatile\([^;]*\);\s*\}//g' \
        vendor/azul-layout/src/window.rs \
        vendor/azul-layout/src/solver3/cache.rs \
        vendor/azul-layout/src/solver3/mod.rs \
        vendor/azul-layout/src/solver3/layout_tree.rs
    remaining=$(grep -rc 'write_volatile' vendor/azul-layout/src/ | awk -F: '{s+=$2} END {print s+0}')
    if [ "$remaining" != "0" ]; then
        echo "ERROR: $remaining write_volatile calls left in vendor/azul-layout" >&2
        exit 1
    fi
fi

echo "prepare.sh done — now: cargo run --release"
