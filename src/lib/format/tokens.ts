import type { CompilePreset } from "@/lib/export/compile";

/** Shared typography tokens — screen CSS, EPUB, DOCX, and PDF pull from here. */
export type FormatTypography = {
  bodyFontFamily: string;
  bodyFontDocx: string;
  headingFontFamily: string;
  bodySizePt: number;
  /** DOCX font size in half-points (22 = 11pt). */
  bodySizeDocx: number;
  heading1SizeDocx: number;
  lineHeight: number;
  /** Paragraph first-line indent in em. */
  paragraphIndentEm: number;
  ink: string;
  muted: string;
  accent: string;
};

export const FORMAT_TYPOGRAPHY: Record<CompilePreset, FormatTypography> = {
  reading: {
    bodyFontFamily:
      '"Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif',
    bodyFontDocx: "Georgia",
    headingFontFamily:
      '"Palatino Linotype", Palatino, Georgia, serif',
    bodySizePt: 11,
    bodySizeDocx: 22,
    heading1SizeDocx: 32,
    lineHeight: 1.7,
    paragraphIndentEm: 1.5,
    ink: "#2d2a26",
    muted: "#6b645c",
    accent: "#b08d57",
  },
  submission: {
    bodyFontFamily: '"Times New Roman", Times, serif',
    bodyFontDocx: "Times New Roman",
    headingFontFamily: '"Times New Roman", Times, serif',
    bodySizePt: 12,
    bodySizeDocx: 24,
    heading1SizeDocx: 24,
    lineHeight: 2,
    paragraphIndentEm: 0.5,
    ink: "#2d2a26",
    muted: "#2d2a26",
    accent: "#2d2a26",
  },
};

export function typographyForPreset(preset: CompilePreset): FormatTypography {
  return FORMAT_TYPOGRAPHY[preset];
}

/** Generate EPUB stylesheet from shared tokens. */
export function epubStylesheet(preset: CompilePreset): string {
  const t = typographyForPreset(preset);
  const justify = preset === "reading" ? "justify" : "left";

  return `/* Folio — novel stylesheet for EPUB */
@namespace epub "http://www.idpf.org/2007/ops";

html {
  font-size: 100%;
}

body {
  font-family: ${t.bodyFontFamily};
  line-height: ${t.lineHeight};
  margin: 0;
  padding: 0;
  color: ${t.ink};
  widows: 2;
  orphans: 2;
}

h1, h2, h3 {
  font-family: ${t.headingFontFamily};
  font-weight: normal;
  text-align: center;
  line-height: 1.25;
  page-break-after: avoid;
  margin: 2.5em 0 1.5em;
}

h1 {
  font-size: 1.65em;
  letter-spacing: 0.04em;
  font-variant: small-caps;
  margin-top: 3em;
}

h2 { font-size: 1.3em; }
h3 { font-size: 1.15em; }

p {
  margin: 0;
  text-align: ${justify};
  text-indent: ${t.paragraphIndentEm}em;
  hyphens: auto;
  -webkit-hyphens: auto;
}

h1 + p, h2 + p, h3 + p, .scene-break + p, blockquote + p, .front-matter + p {
  text-indent: 0;
}

strong, b { font-weight: bold; }
em, i { font-style: italic; }

blockquote {
  margin: 1.4em 1.5em;
  font-style: italic;
  color: ${t.muted};
}

blockquote p { text-indent: 0; }

.scene-break {
  display: block;
  text-align: center;
  text-align-last: center;
  text-indent: 0 !important;
  letter-spacing: normal;
  margin: 2em 0 !important;
  color: ${t.muted};
}

.scene-break .scene-break-mark {
  display: inline;
  letter-spacing: normal;
  white-space: pre;
}

.scene-break-blank {
  letter-spacing: normal;
  margin: 1.25em 0 !important;
  color: transparent;
}

.title-page {
  text-align: center;
  margin-top: 35%;
}

.title-page h1 {
  font-size: 2em;
  font-variant: normal;
  letter-spacing: 0.02em;
  margin: 0 0 1em;
}

.title-page .author {
  font-style: italic;
  font-size: 1.1em;
  color: ${t.muted};
}

.title-page .ornament {
  margin: 2em auto;
  letter-spacing: 0.5em;
  color: ${t.accent};
}

.front-matter {
  text-align: center;
  margin: 20% 1.5em 0;
}

.front-matter p {
  text-align: center;
  text-indent: 0;
}

.front-matter .attribution {
  margin-top: 1.5em;
  font-style: italic;
  color: ${t.muted};
}

.front-matter.copyright {
  margin-top: 60%;
  text-align: left;
}

.front-matter.copyright p {
  text-align: left;
  font-size: 0.85em;
}

.nav-toc ol {
  list-style: none;
  padding: 0;
}

.nav-toc a {
  text-decoration: none;
  color: inherit;
}

.part-divider {
  text-align: center;
  margin: 3em 0 2em;
  page-break-before: always;
}

.book-chapter.page-break-before {
  page-break-before: always;
}
`;
}

/** In-app book preview — scopes EPUB rules under `.book-preview-root`. */
export function previewStylesheet(preset: CompilePreset): string {
  const base = epubStylesheet(preset)
    .replace(/\bbody\b/g, ".book-preview-root")
    .replace(/html\s*\{[^}]*\}/g, "");

  return `${base}

.book-preview-root {
  max-width: 36rem;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
}

.book-preview-root .book-chapter.page-break-before {
  break-before: page;
  page-break-before: always;
  margin-top: 4rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(45, 42, 38, 0.08);
}

.book-preview-root .part-divider {
  text-align: center;
  margin: 3.5rem 0 2rem;
  page-break-before: always;
}

.book-preview-root .part-divider h1 {
  margin-top: 0;
  font-variant: small-caps;
  letter-spacing: 0.12em;
}
`;
}
