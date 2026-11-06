# Architectural & Implementation Decisions

This document records architectural, technical, and implementation decisions made during the development of Resume Vault in accordance with the PRD/TRD in `start.md`.

## 1. Pinned Tech Stack & Libraries
- **React & Vite**: React 18 with Vite 5 and TypeScript strict mode.
- **Routing**: `HashRouter` from `react-router-dom` to ensure seamless deep linking on GitHub Pages without 404 configuration workarounds.
- **Styling**: Tailwind CSS v3 with CSS custom properties (`--bg`, `--surface`, `--text`, `--muted`, `--border`, `--radius-card`, `--radius-sheet`, `--shadow-card`) to dynamically switch between light and dark modes cleanly.
- **Icons**: `lucide-react` for clean, consistent UI iconography.
- **PDF Pipeline**: `pdfjs-dist` v3.11 with dedicated web worker URL for thumbnail generation (canvas export to WebP quality 0.82 / JPEG fallback) and in-viewer lazy page rendering.
- **Storage & State**: `idb-keyval` for IndexedDB cache and offline persistence, Zustand for reactive state and optimistic local updates.
- **Sync**: GitHub REST API (`api.github.com/repos/{owner}/{repo}/contents/{path}`) targeting private repository `resume-vault-data`. Chunked 32 KB base64 serialization for robust file transfer up to 25 MB without stack overflows.

## 2. Bundling & Environment Nuances
- **PDF.js Web Worker**: In `pdfjs-dist` 3.11, the worker filename is `pdf.worker.min.js` (referenced via `?url` suffix). Vite builds this worker into a separate lazy-loaded chunk so the main application bundle stays under 250 KB gzipped.
- **TypeScript 5.6 BufferSource Typing**: Modern TypeScript strict mode types `Uint8Array` generic as `ArrayBufferLike` (which includes `SharedArrayBuffer`). A utility `createBlobFromBytes` was added in `files.ts` to cleanly instantiate DOM `Blob` instances with explicit `BlobPart` casting.
- **PWA Asset Generation**: Generated PNG icons (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-180.png`) via a pure Node.js PNG encoder script (`scripts/generate-icons.js`) utilizing built-in `zlib` without third-party image manipulation binaries.

## 3. Conflict Resolution & Sync Defaults
- **Three-Way Merge**: Non-destructive merge logic comparing `updatedAt` timestamps per entity. Newer `updatedAt` wins. Tombstones (`deletedAt`) are respected and propagate across devices.
- **30-Day Trash Purge**: On every app launch, items in Trash whose `deletedAt` is older than 30 days are purged from the manifest, and `DELETE_BLOB` ops are enqueued to erase the underlying PDF/DOCX and thumbnail files on GitHub.
