# Resume Vault: PRD + TRD + Implementation Plan

> Audience: an autonomous coding agent. Build bottom-up, follow the steps in order, and do not ask questions. Every decision is already made here. If something is genuinely unspecified, pick the simplest option, record it in `DECISIONS.md`, and continue.

---

# PART 1: PRD (Product Requirements)

## 1.1 One-liner
A private, single-user, phone-first web app (installable PWA) to store many versions of my resume, grouped by track (e.g. Product, Data Science), shown visually by date, with the latest one always one tap away. Data syncs between phone and laptop.

## 1.2 Goals
1. Open the app and see the latest resume of every track in under 2 seconds, as large thumbnails.
2. Keep unlimited versions per track, displayed as a visual date-wise timeline.
3. Add a new version in 3 taps from the phone (Add, pick file, Save).
4. Same data on phone and laptop.
5. Zero cost and zero expiry: nothing that pauses or deletes after inactivity.

## 1.3 Non-goals (do NOT build)
Multi-user, accounts or sign-up, resume editing or builder, AI features, comments, public sharing links, analytics, notifications, a backend server.

## 1.4 User and context
One user (me), on an Android or iPhone browser and a laptop browser. Mostly mobile, one hand, often in a hurry (e.g. about to send a resume to a recruiter).

## 1.5 Core concepts
- **Track**: a named category of resume, with an emoji and a color. Examples: "Product" 🧭, "Data Science" 📊. I can add, rename, recolor and reorder tracks, and archive them.
- **Version**: one uploaded resume file inside a track, with a label (e.g. "Fintech focus"), a version date (defaults to today, editable), an optional note, and a thumbnail of page 1.
- **Latest**: the version with the newest `versionDate` in a track (ties broken by `createdAt`). It is computed and never stored.

## 1.6 Functional requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | Home screen: one section per track. Each section has a big "Latest" hero card (page-1 thumbnail, label, date, version count) and a horizontal strip of older versions. | P0 |
| F2 | Hero card quick actions: **View**, **Share**, **Download**. | P0 |
| F3 | Track screen: date-wise visual timeline. Versions are grouped under sticky month headers ("November 2026") as a thumbnail grid (2 columns on phone, 3–5 on wide screens). Newest first. The latest has a "Latest" badge. | P0 |
| F4 | Add version flow: pick a file (PDF primary, DOCX allowed), choose a track (preselected if started from a track), label, date, optional note, Save. Thumbnail generated automatically for PDFs. | P0 |
| F5 | In-app viewer: scrollable PDF pages, with Download and Share buttons. DOCX shows a file card with Download only. | P0 |
| F6 | Edit a version (label, date, note, move to another track). Delete moves it to Trash. Trash holds items for 30 days and lets me Restore or Delete forever. | P0 |
| F7 | Track management: create, rename, emoji, color, reorder, archive. | P0 |
| F8 | Cross-device sync via the storage backend (see TRD). Opening the app on any device pulls the latest data. Edits made offline are queued and sync when online. | P0 |
| F9 | Installable PWA with offline read access to everything already opened or cached. | P0 |
| F10 | Search box (label, note, track) on Home. | P1 |
| F11 | Dark mode (follows the system) and a manual override. | P1 |
| F12 | "Copy setup code" in Settings, to log in on a new device by pasting it. | P1 |
| F13 | Android Web Share Target: share a PDF from another app into Add version. | P2 |
| F14 | Export everything as a ZIP. | P2 |

## 1.7 UX specification (phone first, 390×844 reference)

**Design language**: calm, modern, card-based. Large rounded thumbnails (radius 16), generous spacing, one accent color per track used for the section header chip and badges. System font stack, with numerals set tabular. All tap targets are at least 44px. It must feel native: bottom tab bar, bottom sheets instead of modals, smooth transitions, skeleton loaders.

```
HOME (phone)                         TRACK SCREEN
┌──────────────────────────┐         ┌──────────────────────────┐
│ Resume Vault        ⌕  ⚙ │         │ ←  🧭 Product      ⋯     │
│                          │         │ 7 versions               │
│ 🧭 Product        See all│         │ ── November 2026 ─────── │
│ ┌──────────────────────┐ │         │ ┌───────┐ ┌───────┐      │
│ │ ┌────────┐ LATEST    │ │         │ │thumb  │ │thumb  │      │
│ │ │ thumb  │ Fintech v3│ │         │ │LATEST │ │       │      │
│ │ │ page 1 │ 12 Oct '26│ │         │ │Fintech│ │Growth │      │
│ │ └────────┘ 7 versions│ │         │ │12 Nov │ │03 Nov │      │
│ │ [View][Share][⬇]     │ │         │ └───────┘ └───────┘      │
│ └──────────────────────┘ │         │ ── August 2026 ───────── │
│ ▭ ▭ ▭ ▭  (older, scroll) │         │ ┌───────┐ ┌───────┐      │
│                          │         │ │  …    │ │  …    │      │
│ 📊 Data Science   See all│         └──────────────────────────┘
│ [ same layout ]          │
│                          │         VIEWER: full-screen, pages stacked,
│  ⌂ Home   ＋Add   ⚙      │         top bar [←  label  ⬇  ⤴]
└──────────────────────────┘
```

- Bottom tab bar: Home, Add (a prominent center button), Settings.
- Desktop (≥1024px): same content, with the tab bar becoming a left rail and the content centered at max-width 1100px. The hero card layout becomes a wide card.
- Long-press (touch) or ⋯ on a version opens a bottom sheet: View, Share, Download, Edit, Move, Delete.
- Empty states are friendly and illustrated with emoji, each with one clear button.
- Never block on the network for reading. Show cached data instantly, then update silently. A small "Synced just now / Offline / Syncing…" indicator lives in Settings and in the header as a dot.

## 1.8 Acceptance (product-level)
- Fresh install on phone, paste the setup code, and the same data as the laptop appears.
- Upload a PDF from the phone, and it appears on the laptop after a refresh within 5 seconds.
- Latest hero updates correctly when a newer-dated version is added or the date is edited.
- Works in airplane mode for already-cached content. Edits made offline sync later without loss.
- Lighthouse PWA installable; performance ≥ 90 on mobile for the shell.

---

# PART 2: TRD (Technical Requirements)

## 2.1 Hard constraints
- **No paid services. No service that pauses or deletes on inactivity.** This rules out Supabase free (it pauses), Heroku, and Render free (sleeps, deletes databases). Firebase Storage is also out, since new buckets require a billing plan.
- No custom server. Static frontend plus a storage backend.
- No credit card anywhere.

## 2.2 Architecture decision (final)

| Concern | Choice | Why |
|---|---|---|
| Frontend hosting | **GitHub Pages** from a *public* repo `resume-vault` (code only, no personal data) | Free, permanent, no sleeping, HTTPS (needed for PWA) |
| Data storage + sync | **A *private* GitHub repo `resume-vault-data`**, accessed from the browser via the GitHub REST **Contents API** using a fine-grained Personal Access Token | Free, never pauses, files up to 100 MB, every change is versioned by git for free, CORS-enabled |
| Auth | Fine-grained PAT, scoped to **only** `resume-vault-data`, permission *Contents: Read and write*. Stored in `localStorage` on each of my devices. | Single user. No auth server needed. |
| Offline cache | IndexedDB (via `idb-keyval`) | Instant open, offline reads |

Security note (document in README): the token only has access to one private repo, which holds only my resumes. Anyone with the token can read and write that repo, so the setup code must be treated like a password. Set the token expiry to the max allowed and put a reminder in the README to rotate it. The app must show a clear "Token expired or invalid, re-enter" screen on 401.

## 2.3 Tech stack (pin to latest stable at build time)
- Vite + React 18 + TypeScript (strict)
- Tailwind CSS v3 or v4, `clsx`
- React Router (hash router, to avoid GitHub Pages 404 issues)
- Zustand (state)
- `idb-keyval` (IndexedDB)
- `pdfjs-dist` (thumbnails + viewer)
- `vite-plugin-pwa` (service worker, manifest)
- `lucide-react` (icons)
- `date-fns` (dates)
- Vitest + Testing Library (unit tests), Playwright (a single mobile E2E smoke test, optional)
- No UI kit, no backend, no ORM.

## 2.4 Repository layout (`resume-vault`)

```
resume-vault/
├─ .github/workflows/deploy.yml
├─ public/
│  ├─ icons/ (192, 512, maskable-512, apple-touch-180)
│  └─ favicon.svg
├─ src/
│  ├─ main.tsx
│  ├─ App.tsx                    # router + shell
│  ├─ styles/index.css           # tailwind + CSS variables (design tokens)
│  ├─ types.ts
│  ├─ lib/
│  │  ├─ github.ts               # GitHub Contents API client
│  │  ├─ cache.ts                # IndexedDB wrappers
│  │  ├─ sync.ts                 # outbox + manifest merge + sync engine
│  │  ├─ pdf.ts                  # thumbnail + page rendering
│  │  ├─ files.ts                # hashing, base64, mime, share/download helpers
│  │  ├─ dates.ts                # grouping, "latest" selector
│  │  └─ config.ts               # localStorage creds, setup-code encode/decode
│  ├─ store/
│  │  └─ useVault.ts             # zustand: manifest, status, actions
│  ├─ screens/
│  │  ├─ Setup.tsx
│  │  ├─ Home.tsx
│  │  ├─ Track.tsx
│  │  ├─ Viewer.tsx
│  │  ├─ AddVersion.tsx
│  │  ├─ Trash.tsx
│  │  └─ Settings.tsx
│  └─ components/
│     ├─ TabBar.tsx, BottomSheet.tsx, HeroCard.tsx, VersionCard.tsx,
│     ├─ MonthHeader.tsx, TrackChip.tsx, EmptyState.tsx, Skeleton.tsx,
│     ├─ SyncDot.tsx, ColorEmojiPicker.tsx, Toast.tsx
├─ vite.config.ts, tsconfig.json, tailwind.config.js, package.json
├─ README.md   # setup instructions for me (human)
└─ DECISIONS.md
```

Data repo `resume-vault-data` (private; created by me, structure created by the app):
```
manifest.json
files/<versionId>.<ext>
thumbs/<versionId>.webp
```

## 2.5 Data model (`src/types.ts`)

```ts
export type ISODate = string;      // "2026-11-05"
export type ISOTime = string;      // "2026-11-05T16:51:00.000Z"

export interface Track {
  id: string;            // crypto.randomUUID()
  name: string;
  emoji: string;         // single emoji
  color: string;         // hex from a fixed 10-color palette
  order: number;         // ascending
  archived: boolean;
  createdAt: ISOTime;
  updatedAt: ISOTime;
}

export interface Version {
  id: string;            // crypto.randomUUID()
  trackId: string;
  label: string;         // required, max 60 chars
  note?: string;         // max 500 chars
  versionDate: ISODate;  // user-editable, default today (local)
  fileName: string;      // original name
  mime: string;          // application/pdf | application/vnd.openxmlformats-officedocument.wordprocessingml.document
  sizeBytes: number;
  sha256: string;
  filePath: string;      // "files/<id>.pdf"
  thumbPath: string | null; // "thumbs/<id>.webp"
  createdAt: ISOTime;
  updatedAt: ISOTime;
  deletedAt: ISOTime | null; // soft delete (Trash)
}

export interface Manifest {
  schema: 1;
  updatedAt: ISOTime;
  tracks: Track[];
  versions: Version[];
}
```

Rules:
- Max upload size is 25 MB (hard reject with a friendly message).
- Allowed types: `.pdf`, `.docx`. Everything else is rejected.
- `latest(trackId)` = non-deleted versions of that track, sorted by `versionDate` desc then `createdAt` desc, first item.
- Trash purge: on every app open, any version with `deletedAt` older than 30 days is permanently removed (manifest entry plus file plus thumb).
- Default tracks created on first run (if the manifest is absent): "Product" 🧭 `#6366F1`, "Data Science" 📊 `#10B981`.

## 2.6 GitHub client (`src/lib/github.ts`)

Config: `{ owner, repo, token }` from `localStorage` key `rv.config`. Base: `https://api.github.com/repos/{owner}/{repo}/contents/{path}`.

Headers for every call: `Authorization: Bearer <token>`, `X-GitHub-Api-Version: 2022-11-28`.

Functions to implement:
- `getFile(path, {raw})`: `GET` with `Accept: application/vnd.github.raw+json` returns bytes (works up to 100 MB). To get the blob `sha` for later updates, use a separate metadata `GET` with `Accept: application/vnd.github+json` (for files over 1 MB the metadata call returns the sha but no content, which is fine).
- `getManifest()`: returns `{manifest, sha}` or `null` on 404.
- `putFile(path, bytes, {sha?, message})`: `PUT`, body `{message, content: base64, sha?}`. Return the new sha.
- `deleteFile(path, sha, message)`: `DELETE`.
- `validate()`: `GET /repos/{owner}/{repo}`; must return `permissions.push === true` and `private === true`, else show an error ("Repo must be private").
- Error handling: 401 → emit `authError`; 403 rate/abuse → exponential backoff; 404 → null; 409 or 422 on manifest PUT → conflict (see 2.7); network failure → throw `OfflineError`.
- Base64 encoding must be chunked (`Uint8Array` to binary string in 32 KB chunks) to avoid call-stack errors on large files.

## 2.7 Sync engine (`src/lib/sync.ts`)

Local-first. The UI always reads from the local manifest in the store (hydrated from IndexedDB), never directly from the network.

**Local state (IndexedDB keys)**: `manifest` (last known), `manifestSha`, `outbox` (array of pending ops), `blob:<path>` (cached files and thumbs, LRU-capped at 150 MB, with thumbs never evicted), `lastSyncAt`.

**Outbox op types**: `UPSERT_TRACK`, `UPSERT_VERSION`, `SOFT_DELETE_VERSION`, `RESTORE_VERSION`, `PURGE_VERSION`, `UPLOAD_BLOB {path, key}`, `DELETE_BLOB {path}`. Each op is idempotent. Applying an op updates the local manifest immediately (optimistic) and appends to the outbox.

**Sync cycle** (`sync()`, runs on app open, on `online` event, on tab visibility change to visible, every 60 s while visible, and after any local mutation, debounced 800 ms). It is guarded by a mutex so only one runs at a time.
1. Pull: fetch the remote manifest metadata. If the sha differs from `manifestSha`, download it and merge: for each entity id, keep the record with the newer `updatedAt`. For soft deletes, the newer `updatedAt` also wins. Tracks and versions never disappear from the manifest except through `PURGE_VERSION`.
2. Push blobs first: for every `UPLOAD_BLOB` op, `putFile`. If the file already exists remotely (same path), skip.
3. Push manifest: serialize the merged manifest and `PUT` it with the last sha. On 409/422, go back to step 1 (re-pull, re-merge, retry), at most 5 attempts, with jitter.
4. Process `DELETE_BLOB` ops only after the manifest push succeeds.
5. Clear the completed ops, update `manifestSha` and `lastSyncAt`, and set status to `synced`.

Status values: `synced | syncing | offline | error | authError`. Expose via the store. Surface failures as a toast with a Retry button. Never lose outbox ops.

First run with no remote manifest: create the default tracks and push the manifest.

## 2.8 PDF handling (`src/lib/pdf.ts`)
- Configure the worker: `import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'; pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;`
- `makeThumbnail(file: Blob): Promise<Blob>`: render page 1 to a canvas at width 480 px (devicePixelRatio capped at 2), export as `image/webp` at quality 0.82 (fall back to jpeg if the browser can't encode webp). Target under 60 KB.
- `renderPages(blob, container)`: the Viewer renders pages lazily. Use IntersectionObserver, render each page at the container width with a DPR cap of 2, and show a skeleton placeholder first.
- DOCX: no thumbnail. Use a styled placeholder card (file-type icon over the track color).

## 2.9 PWA
- `vite-plugin-pwa` with `registerType: 'autoUpdate'`. Precache the app shell. Runtime cache for nothing from `api.github.com` (all data goes through our own IndexedDB cache).
- Manifest: `name: "Resume Vault"`, `short_name: "Resumes"`, `display: "standalone"`, `theme_color` and `background_color` matching the tokens, `start_url: "./"`, `scope: "./"`, icons 192/512 plus a maskable one. Add apple-touch-icon and `apple-mobile-web-app-capable` meta tags. Handle safe-area insets (`env(safe-area-inset-*)`) on the tab bar and headers.
- Vite `base` must be `/resume-vault/` for Pages. Make it overridable via the `VITE_BASE` env var.
- (P2) `share_target` for PDFs, handled by a service worker that stores the file and redirects to Add.

## 2.10 Design tokens (CSS variables in `index.css`)
```
--bg: #F7F7F9;   --surface: #FFFFFF;  --text: #0F1115;  --muted: #6B7280;
--border: #E5E7EB; --radius-card: 16px; --radius-sheet: 24px;
--shadow-card: 0 1px 2px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.06);
dark:  --bg:#0B0C0F; --surface:#15171C; --text:#F3F4F6; --muted:#9CA3AF; --border:#262A31;
Track palette (10): #6366F1 #10B981 #F59E0B #EF4444 #3B82F6 #8B5CF6 #EC4899 #14B8A6 #F97316 #64748B
Thumbnail aspect ratio: 3/4 (object-fit: cover, top aligned). Motion: 180ms ease-out, respect prefers-reduced-motion.
```

## 2.11 Performance and quality budgets
- First meaningful render from the IndexedDB cache in under 300 ms after JS loads.
- JS bundle under 250 KB gzipped, excluding the lazy-loaded pdf.js chunk (load it only on Add or Viewer).
- All images lazy-loaded. Thumbs are served from IndexedDB as object URLs (revoke on unmount).
- Accessibility: labelled buttons, focus rings, contrast AA, semantic headings.

## 2.12 Testing requirements
Unit tests (Vitest) are required for:
- `latest()` selection and tie-breaking
- month grouping (`dates.ts`)
- the manifest merge function (newer `updatedAt` wins, tombstones respected, no loss)
- outbox idempotency
- setup-code encode/decode round trip
- base64 chunking on a 10 MB buffer

Mock the GitHub client for sync tests, including a forced 409 conflict.

---

# PART 3: HUMAN PREREQUISITES (only I can do these; the agent writes them into README.md as a checklist)

1. Create a GitHub account if needed.
2. Create a **private** empty repo `resume-vault-data`.
3. Create a **public** repo `resume-vault` (the agent pushes the code here).
4. Settings → Developer settings → Fine-grained tokens → generate a token: *Only select repositories* → `resume-vault-data`; permission *Contents: Read and write*; expiry as long as allowed.
5. After the first deploy, enable Pages: Settings → Pages → Source = *GitHub Actions*.
6. Open `https://<username>.github.io/resume-vault/` on the phone and laptop. Enter `<username>/resume-vault-data` plus the token. Use "Add to Home Screen" on the phone.

Agent: if you have `gh` CLI access and credentials, you may automate steps 2, 3 and 5. Otherwise, stop at the end and output this checklist.

---

# PART 4: STEP-BY-STEP IMPLEMENTATION PLAN (bottom-up)

Rules for the agent: complete the steps in order. After each step, run `npm run typecheck && npm test && npm run build` and commit with the message `step N: <title>`. Do not start the next step with a failing check. Never leave TODOs in shipped code.

### Step 1: Scaffold
- `npm create vite@latest . -- --template react-ts`, then install the dependencies from 2.3.
- Configure Tailwind, the path alias `@/` → `src/`, the Vitest setup, and `typecheck`/`test` scripts. Set Vite `base` per 2.9. Set the hash router.
- Create the empty folders and files per 2.4 and `DECISIONS.md`.
- **Done when**: `npm run dev` shows a blank shell and the checks pass.

### Step 2: Design system and app shell
- Implement the tokens, dark mode (`prefers-color-scheme` plus a `data-theme` override), `TabBar` (with safe-area padding), `BottomSheet` (drag-to-dismiss, backdrop, focus trap), `Toast`, `Skeleton`, `EmptyState`, `TrackChip`, `SyncDot`.
- Routes: `/` Home, `/track/:id`, `/view/:versionId`, `/add`, `/trash`, `/settings`, `/setup`, with placeholder screens.
- **Done when**: navigation works at phone and desktop widths (rail layout at ≥1024px).

### Step 3: Types, utilities, config
- `types.ts` (2.5), `dates.ts` (`latest`, `groupByMonth`, formatting like "12 Oct '26"), `files.ts` (`sha256` via `crypto.subtle`, chunked base64, mime validation, 25 MB check, `downloadBlob`, `shareBlob` via the Web Share API with a download fallback), `config.ts` (get/set creds, `encodeSetupCode` / `decodeSetupCode` as base64url JSON `{o,r,t}`).
- Write the unit tests from 2.12 for these.
- **Done when**: tests pass.

### Step 4: GitHub client
- Implement `github.ts` per 2.6, including the `OfflineError` and `authError` events.
- Unit-test it with a mocked `fetch` (success, 404, 401, 409).
- **Done when**: tests pass, and a manual script (`scripts/smoke.ts`, optional) can write and read a file when real creds are in env vars.

### Step 5: Local cache and store
- `cache.ts`: typed wrappers over `idb-keyval` for manifest, sha, outbox, blobs (with the LRU eviction described in 2.7), and `lastSyncAt`.
- `useVault.ts`: hydrate from the cache on boot. Actions: `addTrack`, `updateTrack`, `reorderTracks`, `archiveTrack`, `addVersion`, `updateVersion`, `moveVersion`, `softDeleteVersion`, `restoreVersion`, `purgeVersion`. Each mutates the local manifest, appends the outbox ops, and triggers a debounced sync. Selectors: `tracksOrdered`, `versionsByTrack`, `latestByTrack`, `trash`.
- **Done when**: store unit tests pass (optimistic updates and outbox contents correct).

### Step 6: Sync engine
- Implement `sync.ts` per 2.7, including the merge function, mutex, triggers (open, online, visibility, interval, mutation), and the status in the store. Run the 30-day trash purge on open.
- Test: a forced 409, an offline-then-online queue, and two simulated devices editing different versions (no data loss).
- **Done when**: all sync tests pass.

### Step 7: Setup and Settings screens
- `Setup`: the repo field (`owner/repo`) plus the token field (password input) plus a "Paste setup code" option. On submit, run `validate()` (must be private, must have push access). Save the config, run the first sync (creating default tracks if the repo is empty), and go Home. Any route redirects to `/setup` when there is no config.
- `Settings`: sync status plus a "Sync now" button, "Copy setup code" (with a warning), theme toggle, Trash link, track manager (add, rename, emoji and color picker, reorder with up/down buttons, archive), "Sign out of this device" (clears config and the local cache after confirmation), and the app version.
- Handle `authError` by redirecting to a re-enter-token screen that keeps the local data.
- **Done when**: I can log in on a fresh browser profile and see the default tracks.

### Step 8: Add Version flow (and the PDF lib)
- `pdf.ts` per 2.8, with lazy loading (dynamic import).
- `AddVersion` as a full-screen sheet:
  1. Big "Choose file" drop and tap zone (`<input type="file" accept=".pdf,.docx" />`). Desktop also supports drag and drop.
  2. After the pick: thumbnail preview, label (default from the file name, cleaned), track picker (chips), date (native date input, default today), optional note.
  3. Save: compute the sha256 and thumbnail, call `addVersion`, and enqueue the blob uploads. Close immediately with a toast, "Saved. Syncing…". There is no waiting on the network.
- Reject unsupported types or oversize files with a clear message.
- **Done when**: adding a PDF shows it instantly on Home and Track, and it appears in the data repo after sync.

### Step 9: Home screen
- For each non-archived track, in order: a section header (`TrackChip`, version count, "See all"), a `HeroCard` for the latest (thumbnail 3:4, "LATEST" badge, label, "Updated 12 Oct '26", and the actions **View / Share / Download**), and below it a horizontally scrolling strip of older `VersionCard`s (snap scrolling).
- Header search (F10): filters versions across tracks by label, note and track name, and shows results as a grid.
- Empty states: no versions in a track shows "Add your first Product resume" with a button, and a vault with no tracks shows "Create a track".
- Skeletons while hydrating. Desktop: the hero card becomes a wide two-column card.
- **Done when**: it looks polished at 390 px and 1280 px, and the actions work.

### Step 10: Track screen (date-wise timeline)
- Header with the track name, the emoji in the track color, the version count, and a ⋯ menu (rename, recolor, archive).
- Versions grouped by month with sticky month headers (`groupByMonth`), newest first. Grid of `VersionCard` (2 columns on phone, up to 5 on desktop), with the "LATEST" badge on the first item overall.
- Tap a card to open the Viewer. Long-press or ⋯ opens the action sheet (View, Share, Download, Edit, Move, Delete).
- A floating "＋" button opens Add with this track preselected.
- **Done when**: months group correctly across a year boundary (unit-tested), and sticky headers work on iOS Safari.

### Step 11: Viewer
- Fetch the blob from the cache, or from the network via `getFile` (then cache it). Show a progress state.
- PDF: lazy page rendering per 2.8 with pinch-zoom enabled (don't block native zoom), and a top bar with back, label, Download and Share.
- DOCX: a file card with Download and Share.
- Offline with no cached file: show a clear "Not available offline" state with a Retry button.
- **Done when**: a multi-page PDF scrolls smoothly on a mid-range phone.

### Step 12: Edit, Delete, Trash
- Edit sheet (label, date, note, track). Saving bumps `updatedAt`, and the latest status recomputes.
- Delete moves the version to Trash (soft delete), with an Undo toast. The Trash screen lists items with days remaining, plus Restore and "Delete forever" (confirm dialog, enqueue `PURGE_VERSION` and `DELETE_BLOB` ops).
- **Done when**: a delete on the phone propagates to the laptop, and restore works.

### Step 13: PWA and offline
- Configure `vite-plugin-pwa` per 2.9, generate the icons (simple, generated from an SVG: document glyph on an indigo gradient), and add the iOS meta tags and safe-area handling.
- Add an "Install app" hint card in Settings (Android `beforeinstallprompt`; for iOS, text instructions for "Add to Home Screen").
- Verify: with the network off, the app opens, shows cached data, and viewing cached files works. Edits queue and sync after reconnecting.
- **Done when**: Lighthouse reports installable and passes the PWA checks.

### Step 14: CI/CD to GitHub Pages
- `.github/workflows/deploy.yml`: on push to `main`, run `npm ci`, typecheck, test and build, then deploy with `actions/upload-pages-artifact` and `actions/deploy-pages` (permissions: `pages: write`, `id-token: write`).
- Write the `README.md` with the Part 3 checklist, a token rotation note, and a "restore from the data repo" note (every file is plain, so I can download resumes straight from GitHub if the app is ever gone).
- **Done when**: the pipeline is green and the site is live (or, if the agent has no GitHub access, the workflow file is ready and the README tells me what to push).

### Step 15: Polish and QA pass
- Test at 360, 390, 430 and 1280 px, in light and dark mode, in iOS Safari and Android Chrome (via Playwright mobile emulation as a smoke test: setup with a mocked GitHub, add a version, see it as latest).
- Verify 44 px tap targets, safe-area handling, focus states, reduced motion, and no layout shift when thumbnails load (reserve the 3:4 box).
- Run through the product acceptance list in 1.8 and fix any failure.
- **Done when**: every box in 1.8 is true.

### Step 16 (optional, only if everything above is done): P2 items
Android share target (F13) and ZIP export (F14, using a lazy-loaded `fflate`).

---

# PART 5: DEFAULT DECISIONS (do not re-litigate)
- Soft-delete and last-write-wins by `updatedAt` are enough conflict handling for one user.
- A single `manifest.json` is fine up to thousands of versions. No sharding.
- No file encryption at rest (the repo is private). Mention in the README that client-side encryption is a possible future step.
- Use a hash router, UUIDs, and ISO date strings. All dates are the user's local calendar dates, stored as `YYYY-MM-DD`.
- If `webp` encoding is unsupported, use jpeg. If `navigator.share` with files is unsupported, fall back to download.
- Do not add libraries beyond those listed in 2.3 without writing the reason in `DECISIONS.md`.

# PART 6: DEFINITION OF DONE
All steps 1–15 are complete. CI is green. The app is deployed (or deploy-ready). `README.md` contains the human checklist. All unit tests pass. The product acceptance list (1.8) is verified. `DECISIONS.md` lists any deviations.