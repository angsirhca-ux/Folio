import mammoth from "mammoth";
import { htmlToBlocks } from "./html";
import type { ImportBlock } from "./types";

export async function docxToBlocks(buffer: ArrayBuffer): Promise<ImportBlock[]> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      styleMap: [
        "p[style-name='Title'] => h1:fresh",
        "p[style-name='Subtitle'] => h2:fresh",
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
        "p[style-name='heading 1'] => h1:fresh",
        "p[style-name='heading 2'] => h2:fresh",
        "p[style-name='Chapter Title'] => h1:fresh",
        "p[style-name='Chapter'] => h1:fresh",
        "p[style-name='CHAPTER'] => h1:fresh",
        "p[style-name='Chapitre'] => h1:fresh",
        "p[style-name='Titel'] => h1:fresh",
        // Drop foreign emphasis chrome — Folio owns typography
        "u => span",
        "strike => span",
        "comment-reference =>",
      ],
      includeDefaultStyleMap: true,
      convertImage: mammoth.images.imgElement(() =>
        Promise.resolve({ src: "" }),
      ),
    },
  );
  // Ignore failed/empty images; keep text-only semantic HTML
  const html = result.value
    .replace(/<img\b[^>]*>/gi, "")
    .replace(/<a\b[^>]*>/gi, "")
    .replace(/<\/a>/gi, "");
  return htmlToBlocks(html);
}
