<p align="center">
  <img src="assets/logo.svg" width="96" height="96" alt="Marginmark logo">
</p>
<h1 align="center">Marginmark</h1>
<p align="center">Highlight the web. Keep your notes local.</p>

A Firefox highlighter for web pages and PDFs, with notes saved as Markdown and JSON in your Obsidian vault or any local folder.

**No account. No cloud. Your files.**

## Features

- Persistent highlights with readable colors on light and dark pages.
- Inline notes, tags, Markdown formatting and automatic saving.
- Search, collections, bookmarks and favorites.
- Dedicated PDF reader for local files and remote documents.
- Offline text reader and basic flashcards.
- Web Highlights JSON import, with original records preserved.
- Markdown, HTML and PDF export.
- Conflict detection and local revision history.

## Get started

**Requirements:** Linux, Firefox 128+, Python 3 and Node.js 20.16+. Tested with Firefox 158.0.1. Interface currently in Italian.

```sh
git clone https://github.com/manusw7/marginmark.git
cd marginmark
npm ci
npm run build
python3 scripts/install.py --vault "$HOME/Documents/Marginmark"
```

For Obsidian, pass an existing folder inside your vault to `--vault`.

1. Open `about:debugging#/runtime/this-firefox`.
2. Choose **Load Temporary Add-on**.
3. Select `extension/manifest.json`.
4. Select some text and choose a color, or press **Alt+S**.
5. Click a saved highlight to edit its note and tags.

Temporary installation lasts until Firefox closes. Files stay on disk. Permanent installation on Firefox Release requires [Mozilla signing](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/).

### Import existing highlights

- Open the extension’s library and choose your Web Highlights JSON backup.
- Repeated imports skip existing IDs.
- Existing local edits are preserved; no incremental merging of matching records.

## Your files

```text
Your chosen folder/
  Highlights/              Markdown notes and JSON records
  PDF/                     PDFs selected from disk
  .local-highlights/       Import archives and revision history
```

- Python native host: file access through Firefox Native Messaging. No local web server.
- Default folder: `~/Documents/Marginmark`.
- Editable Obsidian notes: after `<!-- local-highlights:generated:end -->` in each Markdown file.
- Generated content changed externally: saving blocked, files preserved.
- Deletion: immediate, with previous files retained in the local history.
- History: no automatic pruning.
- PDF.js and pdf-lib: bundled locally during the build. No runtime CDN.

## Development

```sh
npm test
npm run lint
npm run test:firefox
```

Firefox tests use a separate profile, native host and temporary data folder.

## Current limits

- Early version, unsigned Firefox extension. Linux native host only.
- Markdown editor; rich text rendering and OCR not included.
- Restricted Firefox pages, website shadow DOM and embedded frames excluded.
- PDF export embeds visual highlight rectangles; notes stay in local files.
- Changes to source pages can prevent a saved quote from matching.
- JSON and Markdown writes are atomic individually, not as a pair. Avoid simultaneous edits to generated content.
- Cloud sync, AI, automatic YouTube transcripts and external service integrations not included.
- Independent project. Web Highlights is referenced for import compatibility.

## License

MIT. Bundled dependencies retain their licenses: [PDF.js](https://github.com/mozilla/pdf.js) (Apache-2.0) and [pdf-lib](https://github.com/Hopding/pdf-lib) (MIT).
