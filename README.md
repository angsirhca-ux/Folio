# Folio Desk

A quiet novel studio — write the manuscript, keep a world bible beside it, and invite help only when you want it.

Less software. More book.

## Design

- Warm paper, dark ink, muted gold
- Serif typography (EB Garamond, Cormorant, Literata, Crimson Pro)
- Three themes: Classic Novel, Midnight Library, Parchment
- Focus mode, chapters, scene breaks, invisible autosave

## Stack

Next.js · React · TypeScript · Tailwind CSS · Tiptap · Framer Motion · Electron

## Develop (web)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Desktop app

Folio Desk ships as a native desktop app via Electron. The app bundles a local Next.js server — your manuscripts stay on your machine.

### Run in development

Starts Next.js and opens the Electron shell:

```bash
npm run desktop:dev
```

### Run a production build locally

```bash
npm run desktop:start
```

### Package for distribution

Build an installable app in `dist-desktop/`:

```bash
# macOS — .app folder (fast, good for testing)
npm run desktop:dist:dir

# macOS — signed DMG + ZIP (requires Apple Developer ID for signing)
npm run desktop:dist:mac

# All platforms configured in electron-builder.yml
npm run desktop:dist
```

**API keys:** Put your `.env.local` values in `~/Library/Application Support/Folio Desk/.env` (macOS) so Clarence and other AI features work in the packaged app.

## Shortcuts

| Shortcut | Action |
|----------|--------|
| ⌘ O | Upload manuscript |
| ⌘ E | Export EPUB / PDF / Word / text |
| ⌘ F | Find & replace (manuscript) |
| ⌘ K | Project search |
| ⌘ ⌥ F | Focus mode |
| ⌘ \ | Toggle sidebar |
| ⌘ ⇧ N | Chapter notes |
| ⌘ . | Fullscreen writing |
| ⌘ , | Settings |
| ⌘ / | Formatting toolbar |

## Import

Upload a manuscript (`.docx`, `.odt`, `.txt`, `.md`, `.html`, or `.epub`). Folio detects chapter headings and builds your Contents list automatically.

Open Upload from the arrow-up icon, Settings, or `⌘ O`.

## Export

- **EPUB** — EPUB3 with title page, chapter navigation, and novel typography for Apple Books, Kindle, Kobo, and other readers
- **PDF** — trade-paperback page size with title page, chapter breaks, and serif typesetting
- **Word (.docx)** — editable manuscript for Microsoft Word and Google Docs
- **Plain text (.txt)** — clean UTF-8 text, universal and distraction-free

Open Export from the download icon in the toolbar, via Settings, or with `⌘ E`.

## Philosophy

Would Apple ship this? Would it feel at home in a beautifully typeset classic? If not, redesign.
