import JSZip from "jszip";
import type { Book } from "@/lib/types";
import { epubStylesheet } from "@/lib/format/tokens";
import {
  chaptersForCompile,
  compileOptionsForBook,
  frontMatterSections,
  partDividerForChapter,
  type CompileOptions,
} from "./compile";
import {
  bookFilename,
  chapterToXhtmlBody,
  downloadBlob,
  escapeXml,
  frontMatterSectionToXhtml,
  partDividerXhtml,
  sanitizeFilename,
} from "./manuscript";

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
  options: CompileOptions = compileOptionsForBook(book),
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
  oebps.file("styles.css", epubStylesheet(options.preset));

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

  const fmSections = frontMatterSections(book, options);
  const fmFiles = fmSections.map((section, index) => {
    const href = `front-${pad(index + 1)}.xhtml`;
    oebps.file(
      href,
      xhtmlDocument(
        section.title,
        frontMatterSectionToXhtml(section),
      ),
    );
    return {
      id: `front${pad(index + 1)}`,
      href,
      title: section.title,
    };
  });

  const chapterFiles = chapters.map((chapter, index) => {
    const href = `chapter-${pad(index + 1)}.xhtml`;
    const part = partDividerForChapter(chapters, index);
    const pageBreak =
      Boolean(chapter.compile?.pageBreakBefore) &&
      (index > 0 || options.includeTitlePage || fmFiles.length > 0);
    const inner = chapterToXhtmlBody(chapter, {
      sceneBreak: options.sceneBreak,
      suppressTitle: chapter.compile?.suppressTitle,
    });
    const body = [
      part ? partDividerXhtml(part) : "",
      `<section class="book-chapter${pageBreak ? " page-break-before" : ""}">${inner}</section>`,
    ]
      .filter(Boolean)
      .join("\n");
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

  const navList = [...fmFiles, ...chapterFiles]
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
  for (const f of fmFiles) {
    ncxPoints.push(`    <navPoint id="${f.id}" playOrder="${playOrder++}">
      <navLabel><text>${escapeXml(f.title)}</text></navLabel>
      <content src="${f.href}"/>
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
    ...fmFiles.map(
      (f) =>
        `    <item id="${f.id}" href="${f.href}" media-type="application/xhtml+xml"/>`,
    ),
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
    ...fmFiles.map((f) => `    <itemref idref="${f.id}"/>`),
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
  const opts = options ?? compileOptionsForBook(book);
  const blob = await buildEpub(book, opts);
  downloadBlob(blob, bookFilename(book, "epub"));
}

export function epubDisplayName(book: Book): string {
  return `${sanitizeFilename(book.title)}.epub`;
}
