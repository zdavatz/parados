//! Generates one rules PDF per Parados game HTML file.
//!
//! For every game variant in the repo root, this tool extracts the rules
//! modal from the HTML, prepends the web link and the app-store links
//! (iOS/Mac, Android, Windows), and typesets a PDF into `docs/rules/`.
//!
//! Run `./prepare.sh` once (fetches fonts, vendors the patched azul-layout),
//! then: `cargo run --release --manifest-path tools/rules_pdf/Cargo.toml`
//!
//! Rendering quirks this code works around (printpdf 0.10 / azul-layout 0.0.9):
//! - `<b>`/`<strong>` inline elements DROP their text entirely; a
//!   `<span style="font-weight: bold">` renders correctly — the sanitizer
//!   emits only styled spans.
//! - printpdf's font subsetter corrupts some glyphs of the big CJK fonts
//!   (digits render blank). CJK documents therefore embed a font that was
//!   already subset by prepare.sh, with printpdf's own subsetting disabled.
//! - The font matcher is fuzzy across families ("Noto Sans" can match
//!   "Noto Sans JP"), so each language gets its own font pool containing
//!   only the fonts it should use.
//! Every generated PDF is verified afterwards: each glyph referenced by a
//! content stream must have a non-empty outline in the embedded font.

use rules_pdf::verify_pdf_glyphs;
use printpdf::html::{build_font_pool, SharedFontPool};
use printpdf::{
    Actions, BorderArray, Color, ColorArray, GeneratePdfOptions, LinkAnnotation, Op, PdfDocument,
    PdfParseErrorSeverity, PdfSaveOptions, Pt, Rect, TextMatrix,
};
use scraper::{ElementRef, Html, Node, Selector};
use std::collections::{BTreeMap, BTreeSet, HashMap};
use std::path::{Path, PathBuf};

const WEB_BASE: &str = "https://game.ywesee.com/parados/";
const URL_IOS_MAC: &str = "https://apps.apple.com/us/app/parados/id6760842713";
const URL_ANDROID: &str = "https://play.google.com/store/apps/details?id=com.ywesee.parados";
const URL_WINDOWS: &str = "https://apps.microsoft.com/detail/9N7RTWZQQ0K7";

/// Files in the repo root that are not games.
const NON_GAMES: &[&str] = &["index.html", "startpositionen.html"];

const BOLD_OPEN: &str = "<span style=\"font-weight: bold\">";
const ITALIC_OPEN: &str = "<span style=\"font-style: italic\">";

/// Link color, `#0645ad` (Wikipedia blue). `annotate_links` finds the URL
/// text on the page by exactly this fill color, so the two must stay in sync.
const LINK_RGB: (f32, f32, f32) = (0x06 as f32 / 255.0, 0x45 as f32 / 255.0, 0xad as f32 / 255.0);
const LINK_OPEN: &str = "<span style=\"color: #0645ad; text-decoration: underline\">";

/// Which set of fonts a document renders with.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum Script {
    Latin, // incl. Cyrillic
    Jp,
    Sc,
}

struct L10n {
    play_online: &'static str,
    get_app: &'static str,
    rules_word: &'static str,
    font_family: &'static str,
    script: Script,
}

fn l10n(lang: &str) -> L10n {
    match lang {
        "de" => L10n {
            play_online: "Online spielen:",
            get_app: "Hol dir die Parados-App:",
            rules_word: "Regeln",
            font_family: "Noto Sans",
            script: Script::Latin,
        },
        "ja" => L10n {
            play_online: "オンラインでプレイ:",
            get_app: "Parados アプリを入手:",
            rules_word: "ルール",
            font_family: "Noto Sans JP",
            script: Script::Jp,
        },
        l if l.starts_with("zh") => L10n {
            play_online: "在线游玩：",
            get_app: "获取 Parados 应用：",
            rules_word: "规则",
            font_family: "Noto Sans SC",
            script: Script::Sc,
        },
        "uk" => L10n {
            play_online: "Грати онлайн:",
            get_app: "Завантажте додаток Parados:",
            rules_word: "Правила",
            font_family: "Noto Sans",
            script: Script::Latin,
        },
        _ => L10n {
            play_online: "Play online:",
            get_app: "Get the Parados app:",
            rules_word: "Rules",
            font_family: "Noto Sans",
            script: Script::Latin,
        },
    }
}

/// Drops emoji and other pictographs that the text fonts have no glyphs for.
fn is_dropped_char(c: char) -> bool {
    let u = c as u32;
    matches!(u,
        0x1F000..=0x1FFFF // emoji, pictographs, symbols-supplement
        | 0x2600..=0x27BF // misc symbols + dingbats (☀…➿)
        | 0x2B00..=0x2BFF // misc symbols and arrows (⭐)
        | 0xFE00..=0xFE0F // variation selectors
        | 0x200D // zero-width joiner
    )
}

fn clean_text(s: &str, cite_re: &regex::Regex) -> String {
    let s = cite_re.replace_all(s, "");
    s.chars().filter(|c| !is_dropped_char(*c)).collect()
}

fn escape_html(s: &str) -> String {
    s.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

/// Walks the rules modal and re-emits it as clean HTML: headings, paragraphs,
/// lists and inline bold/italic survive; buttons, close-`×` spans and styling
/// are dropped; unknown wrappers (div/span/a) are flattened to their text.
fn sanitize_into(el: ElementRef, out: &mut String, cite_re: &regex::Regex) {
    for child in el.children() {
        match child.value() {
            Node::Text(t) => out.push_str(&escape_html(&clean_text(t, cite_re))),
            Node::Element(e) => {
                let name = e.name();
                if matches!(name, "button" | "script" | "style" | "svg" | "input" | "select") {
                    continue;
                }
                if e.attr("class").is_some_and(|c| c.contains("close")) {
                    continue;
                }
                let child_ref = ElementRef::wrap(child).expect("element node wraps");
                let mapped: Option<(&str, &str)> = match name {
                    "h1" | "h2" => Some(("<h2>", "</h2>")),
                    "h3" => Some(("<h3>", "</h3>")),
                    "h4" => Some(("<h4>", "</h4>")),
                    "p" => Some(("<p>", "</p>")),
                    "ul" => Some(("<ul>", "</ul>")),
                    "ol" => Some(("<ol>", "</ol>")),
                    "li" => Some(("<li>", "</li>")),
                    // azul-layout drops the text inside <b>/<strong>/<em>/<i>;
                    // styled spans render correctly.
                    "b" | "strong" => Some((BOLD_OPEN, "</span>")),
                    "em" | "i" => Some((ITALIC_OPEN, "</span>")),
                    "br" => {
                        out.push_str("<br/>");
                        continue;
                    }
                    "hr" => {
                        out.push_str("<hr/>");
                        continue;
                    }
                    _ => None, // div/span/a/badge…: keep only the text inside
                };
                match mapped {
                    Some((open, close)) => {
                        out.push_str(open);
                        sanitize_into(child_ref, out, cite_re);
                        out.push_str(close);
                    }
                    None => sanitize_into(child_ref, out, cite_re),
                }
            }
            _ => {}
        }
    }
}

struct Extracted {
    title: String,
    lang: String,
    rules_html: String,
}

fn extract(doc_html: &str, cite_re: &regex::Regex) -> Result<Extracted, String> {
    let doc = Html::parse_document(doc_html);

    let lang = doc
        .select(&sel("html"))
        .next()
        .and_then(|e| e.value().attr("lang"))
        .unwrap_or("en")
        .to_string();

    let raw_title = doc
        .select(&sel("title"))
        .next()
        .map(|e| e.text().collect::<String>())
        .ok_or("no <title>")?;
    let mut title = clean_text(&raw_title, cite_re).trim().to_string();
    for suffix in ["— Parados", "- Parados"] {
        if let Some(stripped) = title.strip_suffix(suffix) {
            title = stripped.trim_end().to_string();
        }
    }

    // `.rules-text` before `#modal`: makalaina wraps its rules in a
    // .rules-text inside #modal, makalaina_remote puts them directly in #modal.
    let modal = ["#rulesModal", "#rules-modal", ".rules-text", "#modal"]
        .iter()
        .find_map(|s| doc.select(&sel(s)).next())
        .ok_or("no rules modal found")?;

    let mut rules_html = String::new();
    sanitize_into(modal, &mut rules_html, cite_re);
    if rules_html.trim().is_empty() {
        return Err("rules modal is empty".into());
    }

    Ok(Extracted { title, lang, rules_html })
}

fn sel(s: &str) -> Selector {
    Selector::parse(s).expect("valid selector")
}

fn link_line(label: &str, url: &str) -> String {
    // Trailing no-break space: azul draws the underline one glyph short, so
    // without it the URL's last character would stick out of the underline.
    format!("<p>{label} {LINK_OPEN}{url}&#160;</span></p>")
}

fn page_html(ex: &Extracted, game_url: &str, l: &L10n) -> String {
    let title = escape_html(&ex.title);
    format!(
        r#"<!DOCTYPE html>
<html>
<head>
<style>
body {{ font-family: "{family}"; font-size: 10.5pt; line-height: 1.5; color: #111111; }}
h1 {{ font-size: 19pt; margin: 0 0 8pt 0; }}
h2 {{ font-size: 14pt; margin: 14pt 0 4pt 0; }}
h3 {{ font-size: 11.5pt; margin: 10pt 0 3pt 0; }}
h4 {{ font-size: 10.5pt; margin: 8pt 0 2pt 0; }}
p {{ margin: 4pt 0; }}
ul, ol {{ margin: 4pt 0; padding-left: 18pt; }}
li {{ margin: 3pt 0; }}
div.links {{ background-color: #eeeeee; padding: 8pt 10pt; margin: 0 0 12pt 0; }}
div.links p {{ margin: 2pt 0; }}
</style>
</head>
<body>
<h1>{title}</h1>
<div class="links">
{web_line}
<p>{bold}{get_app}</span></p>
{ios_line}
{android_line}
{windows_line}
</div>
{rules}
</body>
</html>
"#,
        family = l.font_family,
        bold = BOLD_OPEN,
        web_line = link_line(&format!("{}{}</span>", BOLD_OPEN, l.play_online), game_url),
        get_app = l.get_app,
        ios_line = link_line("iOS / Mac:", URL_IOS_MAC),
        android_line = link_line("Android:", URL_ANDROID),
        windows_line = link_line("Windows:", URL_WINDOWS),
        rules = ex.rules_html,
    )
}

/// Makes the URLs clickable. azul's HTML renderer emits no link annotations,
/// so this scans page 1's ops for text runs filled with `LINK_RGB` (only the
/// URLs are that color), groups them into lines, and covers each line with a
/// `LinkAnnotation`. `urls` must be in top-to-bottom page order; the function
/// errors if it doesn't find exactly one line per URL.
fn annotate_links(doc: &mut PdfDocument, urls: &[&str]) -> Result<(), String> {
    let page = doc.pages.first_mut().ok_or("document has no pages")?;

    let is_link_color = |col: &Color| -> bool {
        matches!(col, Color::Rgb(rgb)
            if (rgb.r - LINK_RGB.0).abs() < 0.02
            && (rgb.g - LINK_RGB.1).abs() < 0.02
            && (rgb.b - LINK_RGB.2).abs() < 0.02)
    };

    // (y, min_x, max_x, font_size) per text line drawn in the link color
    let mut lines: Vec<(f32, f32, f32, f32)> = Vec::new();
    let mut link_colored = false;
    let mut font_size = 10.5f32;
    let mut cursor = (0.0f32, 0.0f32);
    let dump = std::env::var("DUMP_OPS").is_ok();
    for op in &page.ops {
        if dump {
            match op {
                Op::SetFillColor { col } => eprintln!("SetFillColor {col:?}"),
                Op::SetTextCursor { pos } => eprintln!("SetTextCursor {:?},{:?}", pos.x, pos.y),
                Op::SetTextMatrix { matrix } => eprintln!("SetTextMatrix {matrix:?}"),
                Op::ShowText { items } => eprintln!("ShowText {} items", items.len()),
                Op::SetFont { size, .. } => eprintln!("SetFont size {size:?}"),
                _ => {}
            }
        }
        match op {
            Op::SetFillColor { col } => link_colored = is_link_color(col),
            Op::SetFont { size, .. } => font_size = size.0,
            Op::SetTextCursor { pos } => cursor = (pos.x.0, pos.y.0),
            Op::SetTextMatrix { matrix } => match matrix {
                TextMatrix::Translate(x, y) => cursor = (x.0, y.0),
                // azul emits every glyph position as a raw [1,0,0,1,x,y] matrix
                TextMatrix::Raw(m) => cursor = (m[4], m[5]),
                _ => {}
            },
            Op::ShowText { .. } if link_colored => {
                match lines.iter_mut().find(|l| (l.0 - cursor.1).abs() < 2.0) {
                    Some(l) => {
                        l.1 = l.1.min(cursor.0);
                        l.2 = l.2.max(cursor.0);
                        l.3 = l.3.max(font_size);
                    }
                    None => lines.push((cursor.1, cursor.0, cursor.0, font_size)),
                }
            }
            _ => {}
        }
    }

    lines.sort_by(|a, b| b.0.total_cmp(&a.0)); // top of page first
    if lines.len() != urls.len() {
        return Err(format!(
            "expected {} link-colored lines on page 1, found {}",
            urls.len(),
            lines.len()
        ));
    }
    for ((y, min_x, max_x, size), url) in lines.into_iter().zip(urls) {
        // max_x is the *start* of the line's last glyph — pad right by roughly
        // one glyph width, and stretch vertically to cover ascender/descender.
        let rect = Rect {
            x: Pt(min_x - 1.0),
            y: Pt(y - 0.3 * size),
            width: Pt(max_x - min_x + 0.7 * size + 2.0),
            height: Pt(1.3 * size),
            mode: None,
            winding_order: None,
        };
        page.ops.push(Op::LinkAnnotation {
            link: LinkAnnotation::new(
                rect,
                Actions::uri(url.to_string()),
                Some(BorderArray::Solid([0.0, 0.0, 0.0])), // no visible border box
                Some(ColorArray::Transparent),
                None,
            ),
        });
    }
    Ok(())
}

/// Replacement text for symbols a document font may lack. Only applied
/// when the font actually has no glyph for the character.
fn fallback_for(c: char) -> Option<&'static str> {
    match c {
        '→' => Some("->"),
        '←' => Some("<-"),
        '▶' => Some("»"),
        '◀' => Some("«"),
        // decorative undo arrow prefixed to the button name in DL rules
        '↶' => Some(""),
        _ => None,
    }
}

/// Reports characters of `text` that `font` has no glyph for (excluding
/// whitespace), so missing-glyph tofu never ships silently.
fn missing_glyphs(font_bytes: &[u8], text: &str) -> Vec<char> {
    let face = match ttf_parser::Face::parse(font_bytes, 0) {
        Ok(f) => f,
        Err(_) => return Vec::new(),
    };
    let mut missing: Vec<char> = text
        .chars()
        .filter(|c| !c.is_whitespace() && face.glyph_index(*c).is_none())
        .collect();
    missing.sort_unstable();
    missing.dedup();
    missing
}

fn main() -> Result<(), String> {
    let tool_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_root = tool_dir.parent().and_then(Path::parent).ok_or("no repo root")?.to_path_buf();
    let fonts_dir = tool_dir.join("fonts");
    let out_dir = repo_root.join("docs").join("rules");
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

    let cite_re = regex::Regex::new(r"\[cite[^\]]*\]").expect("valid regex");

    let read_font = |file: &str| -> Result<Vec<u8>, String> {
        let path = fonts_dir.join(file);
        std::fs::read(&path)
            .map_err(|e| format!("cannot read font {} ({e}) — run tools/rules_pdf/prepare.sh first", path.display()))
    };

    // One pool per script so the fuzzy font matcher can never pick a
    // same-named family from another language (e.g. "Noto Sans JP" for
    // "Noto Sans"). Keys are IDs; the family names come from the font bytes.
    let mut pool_fonts: BTreeMap<Script, BTreeMap<String, Vec<u8>>> = BTreeMap::new();
    // "-noliga" = OpenType layout features stripped by prepare.sh: printpdf's
    // subsetter maps ligature glyphs (fi, fl, …) to .notdef, so the Latin
    // fonts must never form them in the first place.
    pool_fonts.insert(
        Script::Latin,
        BTreeMap::from([
            ("Noto Sans".to_string(), read_font("NotoSans-Regular-noliga.ttf")?),
            ("Noto Sans Bold".to_string(), read_font("NotoSans-Bold-noliga.ttf")?),
        ]),
    );
    pool_fonts.insert(
        Script::Jp,
        BTreeMap::from([("Noto Sans JP".to_string(), read_font("NotoSansJP-Subset.ttf")?)]),
    );
    pool_fonts.insert(
        Script::Sc,
        BTreeMap::from([("Noto Sans SC".to_string(), read_font("NotoSansSC-Subset.ttf")?)]),
    );
    // No system font scan: output must not depend on the machine.
    let pools: BTreeMap<Script, SharedFontPool> = pool_fonts
        .iter()
        .map(|(script, fonts)| (*script, build_font_pool(fonts, Some(&[]))))
        .collect();

    let mut game_files: Vec<PathBuf> = std::fs::read_dir(&repo_root)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok().map(|e| e.path()))
        .filter(|p| {
            p.extension().is_some_and(|e| e == "html")
                && p.file_name()
                    .and_then(|n| n.to_str())
                    .is_some_and(|n| !NON_GAMES.contains(&n))
        })
        .collect();
    game_files.sort();

    let opts = GeneratePdfOptions {
        margin_top: Some(16.0),
        margin_right: Some(16.0),
        margin_bottom: Some(18.0),
        margin_left: Some(16.0),
        ..Default::default()
    };

    let mut failures = Vec::new();
    for path in &game_files {
        let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or_default();
        let stem = path.file_stem().and_then(|n| n.to_str()).unwrap_or_default();
        let html = std::fs::read_to_string(path).map_err(|e| e.to_string())?;

        let mut ex = match extract(&html, &cite_re) {
            Ok(ex) => ex,
            Err(e) => {
                failures.push(format!("{file_name}: {e}"));
                continue;
            }
        };
        let l = l10n(&ex.lang);
        let game_url = format!("{WEB_BASE}{file_name}");

        let main_font = pool_fonts[&l.script]
            .values()
            .next()
            .expect("pool has a font");
        for c in missing_glyphs(main_font, &format!("{}{}", ex.title, ex.rules_html)) {
            if let Some(repl) = fallback_for(c) {
                ex.title = ex.title.replace(c, repl);
                ex.rules_html = ex.rules_html.replace(c, repl);
            }
        }
        let missing = missing_glyphs(main_font, &format!("{}{}", ex.title, ex.rules_html));
        if !missing.is_empty() {
            failures.push(format!(
                "{file_name}: no glyph for {missing:?} in {} — extend the subset in prepare.sh?",
                l.font_family
            ));
            continue;
        }
        let page = page_html(&ex, &game_url, &l);

        let mut warnings = Vec::new();
        let mut doc = PdfDocument::from_html_with_cache(
            &page,
            &BTreeMap::new(),
            &BTreeMap::new(),
            &opts,
            &mut warnings,
            Some(pools[&l.script].clone()),
        )
        .map_err(|e| format!("{file_name}: {e}"))?;

        annotate_links(&mut doc, &[&game_url, URL_IOS_MAC, URL_ANDROID, URL_WINDOWS])
            .map_err(|e| format!("{file_name}: {e}"))?;

        doc.metadata.info.document_title = format!("{} — {}", ex.title, l.rules_word);
        doc.metadata.info.author = "Walter Prossnitz".to_string();
        doc.metadata.info.creator = "Parados rules_pdf".to_string();
        doc.metadata.info.producer = "printpdf".to_string();
        doc.metadata.info.subject = game_url.clone();

        // printpdf's own subsetter corrupts glyphs of the big CJK fonts;
        // those fonts are pre-subset by prepare.sh, so embed them whole.
        let save_opts = PdfSaveOptions {
            subset_fonts: l.script == Script::Latin,
            ..Default::default()
        };
        let bytes = doc.save(&save_opts, &mut warnings);
        let out_path = out_dir.join(format!("{stem}_rules.pdf"));
        std::fs::write(&out_path, &bytes).map_err(|e| e.to_string())?;

        let glyph_issues = verify_pdf_glyphs(&bytes, Some(&page)).unwrap_or_else(|e| vec![e]);
        if !glyph_issues.is_empty() {
            failures.push(format!("{file_name}: {}", glyph_issues.join("; ")));
        }

        let errors: Vec<_> = warnings
            .iter()
            .filter(|w| w.severity == PdfParseErrorSeverity::Error)
            .map(|w| w.msg.clone())
            .collect();
        println!(
            "  OK {} -> {} ({} pages, {} KB{})",
            file_name,
            out_path.strip_prefix(&repo_root).unwrap_or(&out_path).display(),
            doc.page_count(),
            bytes.len() / 1024,
            if errors.is_empty() { String::new() } else { format!(", {} render errors", errors.len()) },
        );
        for e in errors.iter().take(3) {
            println!("       error: {e}");
        }
    }

    if !failures.is_empty() {
        return Err(format!("failed files:\n  {}", failures.join("\n  ")));
    }
    println!("done: {} PDFs in {}", game_files.len(), out_dir.display());
    Ok(())
}
