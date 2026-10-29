# Sample documents for manual testing

Three fake-but-realistic legal files, each exercising a different ingest path. All names, identifiers, cards and accounts are fictional. Every file was verified through `parseDocument()` and the redactor, so they upload and redact cleanly.

| File | Ingest path | What it exercises |
| --- | --- | --- |
| `deposition-johnson.txt` | text (`kind: "text"`, no page count) | `[[PAGE n]]` markers, Q/A transcript layout, every regex detector |
| `settlement-agreement.docx` | DOCX via `mammoth` (`kind: "docx"`) | headings, paragraphs, a table, signature block |
| `demand-letter.pdf` | PDF via `unpdf` (`kind: "pdf"`, 2 pages) | real PDF text layer, automatic `[[PAGE n]]` markers |

## What to do with them

1. Create a matter (e.g. **Johnson v. Northwind**) — optionally add `Sarah Elizabeth Johnson` and `Acme Corporation` as known terms so aliases share one token.
2. **Vault → Upload documents**, or attach them in a chat turn.
3. Open the document and check the redacted view + the redaction counts per category.

Expected detections (verified locally):

```
deposition-johnson.txt   NAME:34 ADDRESS:9  DATE:8 EMAIL:6 PHONE:5 AMOUNT:4 CARD:2 URL:2 SSN:1 IP:1
settlement-agreement.docx NAME:34 ADDRESS:6 DATE:7 AMOUNT:6 EMAIL:4 PHONE:3 URL:2 SSN:1 CARD:1
demand-letter.pdf        NAME:26 ADDRESS:8 DATE:9 AMOUNT:6 EMAIL:5 PHONE:3 URL:1
```

Names vary between runs of a fresh vault because the NLP name pass is context-dependent, so treat the counts as "roughly this", not exact assertions.

## PII deliberately planted

- **Names:** Sarah Elizabeth Johnson, Marcus T. Whitfield, Elena Rodriguez-Vega, Priya N. Ramanathan, Acme Corporation, Northwind Logistics LLC
- **SSN:** `412-88-9371` (passes the detector's range checks; not a real number)
- **Cards:** `4111 1111 1111 1111`, `5500 0000 0000 0004` (both Luhn-valid test numbers)
- **Dates in all four formats:** `2021-03-03`, `03/15/2022`, `March 3rd, 2021`, `3rd of March, 2021`
- **Money:** `$48,500.00`, `USD 1,250,000`, `€12,500`, `$2.4 million`
- **Contact:** two phone formats plus a dotted one, four email addresses, two addresses with suite/unit
- **Network:** `192.168.14.22`, `203.0.113.7` (TEST-NET-3), two URLs

## If you also want something from the web

These are real, stable, and safe to upload, but they contain little or no PII — useful only for checking PDF extraction:

- IRS Form W-9 — <https://www.irs.gov/pub/irs-pdf/fw9.pdf>
- USCIS Form I-9 — <https://www.uscis.gov/sites/default/files/document/forms/i-9.pdf>

## Known cosmetic behavior when restoring

Redaction → restore round-trips are content-faithful but not byte-identical in two cases: an ALL-CAPS occurrence of a name restores in the canonical case it was first seen (`WHITFIELD` → `Whitfield`), and a single-digit date day can come back zero-padded (`4/2/2022` → `04/02/2022`) because the padding is read from the shifted date, not the original. Both are display-level differences. Upload detection itself is unaffected.
