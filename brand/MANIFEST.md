# Brand asset manifest

Originals are byte-for-byte copies of the supplied logo pack (moved with `git mv`).
Runtime copies in `public/brand/` are identical to `brand/source/` (SVG + PNG only).
No compact mark was supplied, so none is fabricated: the app uses the full wordmark or a text label.

| Old path | New path | Usage |
|---|---|---|
| wordmark-black.svg / .png / .pdf | brand/source/ ; public/brand/ (svg, png) | App identity on light surfaces; PNG for email and formal documents |
| wordmark-white.svg / .png / .pdf | brand/source/ ; public/brand/ | Single-colour on dark surfaces |
| wordmark-colour.* | brand/source/ ; public/brand/ | Light surfaces where green accent is wanted (moss #0C6A49) |
| wordmark-reversed-colour.* | brand/source/ ; public/brand/ | Dark surfaces (bone #EFEBE3 + spring #4FD9A0) |
| README.txt, source-record.json, OneSimpleSite-Usage-Guide.pdf | brand/docs/ | Provenance and guidance |

Brand colours (sRGB): ink #0E1311, moss #0C6A49, spring #4FD9A0, bone #EFEBE3.
PDFs are for print/document workflows only (not served at runtime).
