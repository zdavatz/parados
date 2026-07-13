//! Shared verification helpers for the rules_pdf tool.

use std::collections::{BTreeMap, BTreeSet, HashMap};

/// Post-write sanity check: every glyph a content stream references must have
/// a non-empty outline in its embedded font (this is what caught printpdf's
/// CJK subsetting bug — blank digits). Whitespace-mapped glyphs are exempt.
///
/// When `expected_text` is given, additionally checks — for every embedded
/// font that still carries a cmap — that each non-whitespace character of the
/// text resolves to a glyph with an outline (catches lost glyphs whose
/// ToUnicode entry collides with the space character on gid 0).
pub fn verify_pdf_glyphs(bytes: &[u8], expected_text: Option<&str>) -> Result<Vec<String>, String> {
    use lopdf::{Document, Object};

    let doc = Document::load_mem(bytes).map_err(|e| format!("parse PDF: {e}"))?;
    let mut issues = Vec::new();

    // font resource name (per page) -> (embedded font bytes, gid -> unicode)
    let mut fonts: HashMap<Vec<u8>, (Vec<u8>, HashMap<u16, String>)> = HashMap::new();

    let deref = |obj: &Object| -> Object {
        match obj {
            Object::Reference(id) => doc.get_object(*id).cloned().unwrap_or(Object::Null),
            other => other.clone(),
        }
    };

    for (_, page_id) in doc.get_pages() {
        let page = doc.get_dictionary(page_id).map_err(|e| e.to_string())?;
        let resources = match page.get(b"Resources").map(&deref) {
            Ok(Object::Dictionary(d)) => d,
            _ => continue,
        };
        if let Ok(Object::Dictionary(font_dict)) = resources.get(b"Font").map(&deref) {
            for (fname, fobj) in font_dict.iter() {
                if fonts.contains_key(fname) {
                    continue;
                }
                let Object::Dictionary(f) = deref(fobj) else { continue };
                // Type0 -> DescendantFonts[0] -> FontDescriptor -> FontFile2
                let Ok(Object::Array(desc)) = f.get(b"DescendantFonts").map(&deref) else {
                    continue;
                };
                let Some(Object::Dictionary(df)) = desc.first().map(|o| deref(o)).into_iter().next()
                else {
                    continue;
                };
                let Ok(Object::Dictionary(fd)) = df.get(b"FontDescriptor").map(&deref) else {
                    continue;
                };
                let Ok(Object::Stream(ff)) = fd.get(b"FontFile2").map(&deref) else { continue };
                let font_bytes = ff
                    .decompressed_content()
                    .unwrap_or_else(|_| ff.content.clone());
                // ToUnicode CMap: gid -> text
                let mut gid_to_uni: HashMap<u16, String> = HashMap::new();
                if let Ok(Object::Stream(tu)) = f.get(b"ToUnicode").map(&deref) {
                    let cmap = tu.decompressed_content().unwrap_or_else(|_| tu.content.clone());
                    parse_tounicode(&cmap, &mut gid_to_uni);
                }
                fonts.insert(fname.to_vec(), (font_bytes, gid_to_uni));
            }
        }

        // Collect glyph ids used per font in this page's content stream.
        let content = doc.get_page_content(page_id).map_err(|e| e.to_string())?;
        let ops = lopdf::content::Content::decode(&content).map_err(|e| e.to_string())?;
        let mut cur_font: Vec<u8> = Vec::new();
        let mut used: BTreeMap<Vec<u8>, BTreeSet<u16>> = BTreeMap::new();
        for op in ops.operations {
            match op.operator.as_str() {
                "Tf" => {
                    if let Some(Object::Name(n)) = op.operands.first() {
                        cur_font = n.clone();
                    }
                }
                "Tj" | "TJ" | "'" | "\"" => {
                    for operand in &op.operands {
                        collect_glyph_ids(operand, &mut used, &cur_font);
                    }
                }
                _ => {}
            }
        }

        for (fname, gids) in used {
            let Some((font_bytes, gid_to_uni)) = fonts.get(&fname) else { continue };
            let Ok(face) = ttf_parser::Face::parse(font_bytes, 0) else {
                issues.push(format!("embedded font {:?} unparseable", String::from_utf8_lossy(&fname)));
                continue;
            };
            for gid in gids {
                let uni = gid_to_uni.get(&gid).cloned().unwrap_or_default();
                // printpdf encodes the space character as gid 0; any other
                // .notdef reference means the subsetter lost a glyph.
                if uni.chars().all(|c| c.is_whitespace()) && !uni.is_empty() {
                    continue;
                }
                if gid == 0 {
                    issues.push(format!(
                        "content references .notdef (gid 0, {:?}) in {}",
                        uni,
                        String::from_utf8_lossy(&fname)
                    ));
                    continue;
                }
                if face.glyph_bounding_box(ttf_parser::GlyphId(gid)).is_none() {
                    issues.push(format!(
                        "glyph {gid} ({:?}) has no outline in {}",
                        uni,
                        String::from_utf8_lossy(&fname)
                    ));
                }
            }
        }
    }

    if let Some(text) = expected_text {
        let chars: BTreeSet<char> = text.chars().filter(|c| !c.is_whitespace()).collect();
        for (fname, (font_bytes, _)) in &fonts {
            let Ok(face) = ttf_parser::Face::parse(font_bytes, 0) else { continue };
            for &c in &chars {
                let Some(gid) = face.glyph_index(c) else { continue }; // other font covers it
                if gid.0 != 0 && face.glyph_bounding_box(gid).is_none() {
                    issues.push(format!(
                        "expected char {c:?} maps to empty glyph {} in {}",
                        gid.0,
                        String::from_utf8_lossy(fname)
                    ));
                }
            }
        }
    }
    Ok(issues)
}

fn collect_glyph_ids(
    operand: &lopdf::Object,
    used: &mut BTreeMap<Vec<u8>, BTreeSet<u16>>,
    cur_font: &[u8],
) {
    match operand {
        lopdf::Object::String(s, _) => {
            for pair in s.chunks_exact(2) {
                used.entry(cur_font.to_vec())
                    .or_default()
                    .insert(u16::from_be_bytes([pair[0], pair[1]]));
            }
        }
        lopdf::Object::Array(items) => {
            for item in items {
                collect_glyph_ids(item, used, cur_font);
            }
        }
        _ => {}
    }
}

/// Minimal ToUnicode CMap reader: handles `beginbfchar` pairs and
/// `beginbfrange` with a scalar destination.
fn parse_tounicode(cmap: &[u8], out: &mut HashMap<u16, String>) {
    let text = String::from_utf8_lossy(cmap);
    let hex = |s: &str| -> Option<Vec<u16>> {
        let s = s.trim().trim_start_matches('<').trim_end_matches('>');
        if s.is_empty() || s.len() % 4 != 0 {
            return None;
        }
        (0..s.len())
            .step_by(4)
            .map(|i| u16::from_str_radix(&s[i..i + 4], 16).ok())
            .collect()
    };
    let to_string = |units: &[u16]| String::from_utf16_lossy(units);

    for section in text.split("beginbfchar").skip(1) {
        let body = section.split("endbfchar").next().unwrap_or("");
        let toks: Vec<&str> = body.split_whitespace().collect();
        for pair in toks.chunks_exact(2) {
            if let (Some(src), Some(dst)) = (hex(pair[0]), hex(pair[1])) {
                if let Some(&gid) = src.first() {
                    out.insert(gid, to_string(&dst));
                }
            }
        }
    }
    for section in text.split("beginbfrange").skip(1) {
        let body = section.split("endbfrange").next().unwrap_or("");
        let toks: Vec<&str> = body.split_whitespace().collect();
        for triple in toks.chunks_exact(3) {
            if let (Some(lo), Some(hi), Some(dst)) = (hex(triple[0]), hex(triple[1]), hex(triple[2]))
            {
                if let (Some(&lo), Some(&hi), Some(&base)) = (lo.first(), hi.first(), dst.first()) {
                    for (i, gid) in (lo..=hi).enumerate() {
                        out.insert(gid, to_string(&[base + i as u16]));
                    }
                }
            }
        }
    }
}

