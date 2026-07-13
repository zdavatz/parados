//! Runs the glyph verifier on a PDF given as argv[1] (debug helper).
fn main() {
    let path = std::env::args().nth(1).expect("usage: verify <pdf>");
    let bytes = std::fs::read(&path).unwrap();
    match rules_pdf::verify_pdf_glyphs(&bytes, None) {
        Ok(issues) if issues.is_empty() => println!("OK: no issues"),
        Ok(issues) => {
            for i in &issues {
                println!("ISSUE: {i}");
            }
        }
        Err(e) => println!("ERROR: {e}"),
    }
}
