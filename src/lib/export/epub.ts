import JSZip from "jszip";
import type { Book } from "@/lib/types";
import {
  chaptersForCompile,
  defaultCompileOptions,
  type CompileOptions,
} from "./compile";
import {
  bookFilename,
  chapterToXhtmlBody,
  downloadBlob,
  escapeXml,
  sanitizeFilename,
} from "./manuscript";

const EPUB_CSS = `/* Folio — novel stylesheet for EPUB */
@namespace epub "http://www.idpf.org/2007/ops";

html {
  font-size: 100%;
}

body {
  font-family: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
  line-height: 1.7;
  margin: 0;
  padding: 0;
  color: #2d2a26;
  widows: 2;
  orphans: 2;
}

h1, h2, h3 {
  font-family: "Palatino Linotype", Palatino, Georgia, serif;
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

h2 {
  font-size: 1.3em;
}

h3 {
  font-size: 1.15em;
}

p {
  margin: 0;
  text-align: justify;
  text-indent: 1.5em;
  hyphens: auto;
  -webkit-hyphens: auto;
}

h1 + p,
h2 + p,
h3 + p,
.scene-break + p,
blockquote + p {
  text-indent: 0;
}

blockquote {
  margin: 1.4em 1.5em;
  font-style: italic;
  color: #5c564f;
}

blockquote p {
  text-indent: 0;
}

.scene-break {
  display: block;
  text-align: center;
  text-align-last: center;
  text-indent: 0 !important;
  letter-spacing: normal;
  margin: 2em 0 !important;
  color: #6b645c;
}

.scene-break .scene-break-mark {
  display: inline-block;
  letter-spacing: 0.55em;
  margin-right: -0.55em;
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
  color: #5c564f;
}

.title-page .ornament {
  margin: 2em auto;
  letter-spacing: 0.5em;
  color: #b08d57;
}

.nav-toc ol {
  list-style: none;
  padding: 0;
}

.nav-toc a {
  text-decoration: none;
  color: inherit;
}
`;

function xhtmlDocument(title: string, body: string, cssHref = "styles.css"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en" xml:lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeXml(title)}</title>
  <link rel="stylesheet" type="text/css" href="${cssHref}" />
</head>
<body>
${body}
</body>
</html>`;
}

function pad(n: number): string {
  return String(n).padStart(3, "0");
}

export async function buildEpub(
  book: Book,
  options: CompileOptions = defaultCompileOptions(book),
): Promise<Blob> {
  const zip = new JSZip();
  const title = book.title.trim() || "Untitled Manuscript";
  const author = book.author.trim() || "Anonymous";
  const bookId = `urn:uuid:${crypto.randomUUID()}`;
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const chapters = chaptersForCompile(book, options);

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.folder("META-INF")!.file(
    "container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
  );

  const oebps = zip.folder("OEBPS")!;
  oebps.file("styles.css", EPUB_CSS);

  if (options.includeTitlePage) {
    oebps.file(
      "titlepage.xhtml",
      xhtmlDocument(
        title,
        `<section class="title-page" epub:type="titlepage">
  <h1>${escapeXml(title)}</h1>
  <p class="ornament">* * *</p>
  <p class="author">${escapeXml(author)}</p>
</section>`,
      ),
    );
  }

  const chapterFiles = chapters.map((chapter, index) => {
    const href = `chapter-${pad(index + 1)}.xhtml`;
    const body = chapterToXhtmlBody(chapter, {
      sceneBreak: options.sceneBreak,
    });
    oebps.file(
      href,
      xhtmlDocument(chapter.title || `Chapter ${index + 1}`, body),
    );
    return {
      id: `chap${pad(index + 1)}`,
      href,
      title: chapter.title || `Chapter ${index + 1}`,
    };
  });

  const navList = chapterFiles
    .map(
      (c) =>
        `      <li><a href="${c.href}">${escapeXml(c.title)}</a></li>`,
    )
    .join("\n");

  const tocTitleLink = options.includeTitlePage
    ? `    <li><a href="titlepage.xhtml">${escapeXml(title)}</a></li>\n`
    : "";

  if (options.includeToc) {
    oebps.file(
      "nav.xhtml",
      xhtmlDocument(
        "Contents",
        `<nav epub:type="toc" id="toc" class="nav-toc">
  <h1>Contents</h1>
  <ol>
${tocTitleLink}${navList}
  </ol>
</nav>`,
      ),
    );
  } else {
    // EPUB3 still needs a nav document — keep it minimal / landmarks only
    const first = chapterFiles[0]?.href ?? (options.includeTitlePage ? "titlepage.xhtml" : "");
    oebps.file(
      "nav.xhtml",
      xhtmlDocument(
        "Contents",
        `<nav epub:type="toc" id="toc" class="nav-toc" hidden="hidden">
  <ol>
    ${first ? `<li><a href="${first}">${escapeXml(title)}</a></li>` : ""}
${navList}
  </ol>
</nav>`,
      ),
    );
  }

  let playOrder = 1;
  const ncxPoints: string[] = [];
  if (options.includeTitlePage) {
    ncxPoints.push(`    <navPoint id="title" playOrder="${playOrder++}">
      <navLabel><text>${escapeXml(title)}</text></navLabel>
      <content src="titlepage.xhtml"/>
    </navPoint>`);
  }
  for (const c of chapterFiles) {
    ncxPoints.push(`    <navPoint id="${c.id}" playOrder="${playOrder++}">
      <navLabel><text>${escapeXml(c.title)}</text></navLabel>
      <content src="${c.href}"/>
    </navPoint>`);
  }

  oebps.file(
    "toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${bookId}"/>
    <meta name="dtb:depth" content="1"/>
    <meta name="dtb:totalPageCount" content="0"/>
    <meta name="dtb:maxPageNumber" content="0"/>
  </head>
  <docTitle><text>${escapeXml(title)}</text></docTitle>
  <navMap>
${ncxPoints.join("\n")}
  </navMap>
</ncx>`,
  );

  const manifestItems = [
    ...(options.includeTitlePage
      ? [
          `    <item id="titlepage" href="titlepage.xhtml" media-type="application/xhtml+xml"/>`,
        ]
      : []),
    `    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `    <item id="css" href="styles.css" media-type="text/css"/>`,
    ...chapterFiles.map(
      (c) =>
        `    <item id="${c.id}" href="${c.href}" media-type="application/xhtml+xml"/>`,
    ),
  ].join("\n");

  const spineItems = [
    ...(options.includeTitlePage
      ? [`    <itemref idref="titlepage"/>`]
      : []),
    ...chapterFiles.map((c) => `    <itemref idref="${c.id}"/>`),
  ].join("\n");

  oebps.file(
    "content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="BookId" version="3.0" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${bookId}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:creator>${escapeXml(author)}</dc:creator>
    <dc:language>en</dc:language>
    <dc:publisher>Folio</dc:publisher>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
${manifestItems}
  </manifest>
  <spine toc="ncx">
${spineItems}
  </spine>
</package>`,
  );

  return zip.generateAsync({
    type: "blob",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

export async function exportEpub(
  book: Book,
  options?: CompileOptions,
): Promise<void> {
  const opts = options ?? defaultCompileOptions(book);
  const blob = await buildEpub(book, opts);
  downloadBlob(blob, bookFilename(book, "epub"));
}

export function epubDisplayName(book: Book): string {
  return `${sanitizeFilename(book.title)}.epub`;
}
