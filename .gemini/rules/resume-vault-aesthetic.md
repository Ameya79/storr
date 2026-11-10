---
description: Design system and architectural rules for Resume Vault
globs: ["**/*.tsx", "**/*.ts", "**/*.css"]
---

# Resume Vault: Visual & Technical Guardrails

## 1. Visual Theme: Pure White & Non-AI
- Canvas must be clean pure white (`#ffffff` / `bg-white`).
- Background layers must use neutral zinc/slate tints (`#fafafa`, `#f4f4f5`).
- Borders must be thin, crisp, and high-contrast (`border-zinc-200` or `#e4e4e7`).
- Text must be deep contrast neutral black (`#09090b` / `text-zinc-900`).
- NEVER use generic AI design tropes: NO purple/indigo gradient pills, NO neon blur blobs, NO sparkle (`✨`) icons or magic wands.
- The aesthetic must feel like high-end developer tools (Linear, Vercel, Stripe Dashboard, GitHub Desktop).

## 2. Information Architecture: Branch-Wise
- The primary categorization concept is **Branch** (e.g. `main`, `product-lead`, `data-science`, `freelance`).
- Resume uploads represent chronological **Commits/Versions** along a branch.
- Provide a Git-style branch switcher, branch tree timeline indicators, and branch diff/tag metadata.

## 3. Vector Graphics & Clean SVGs
- Avoid raster decoration or blurry icons. Use crisp, hand-crafted or Lucide vector SVGs with 1.5–2px stroke weights.
- Include custom SVGs for Git branch trees, commit points, merge indicators, and document badges.

## 4. Animation & Interaction
- Use `framer-motion` for spring physics (`type: "spring", damping: 25, stiffness: 300`).
- Implement smooth layout transitions (`layoutId`), gesture-driven swipe down bottom sheets, and responsive tap feedback.
- Mobile first: touch targets $\ge 44\text{px}$, thumb-accessible floating controls.

## 5. Next.js & Vercel-First Stack
- Next.js App Router (`app/` directory).
- Fast client-side hydration with IndexedDB persistence for offline-first resilience.
- Zero-config deployment on Vercel.

## 6. CI/CD & Deployment Invariants
- For Next.js and Vercel-first architecture, GitHub Actions workflows (`.github/workflows/ci.yml`) must strictly act as CI verification:
  1. `npm ci`
  2. `npm run typecheck` (`tsc --noEmit`)
  3. `npm test` (`vitest run`)
  4. `npm run build` (`next build`)
- Never leave obsolete GitHub Pages deployment actions (`actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages`) active when deploying to Vercel.
- Vercel automatically deploys commits to `main` via zero-config integration.

## 7. Open-Source Security, Dual-Storage Persistence & Token Scoping
- **Permanent Dual-Storage Persistence**:
  - Credentials must be dual-persisted to both `localStorage` and `IndexedDB` (`idb-keyval`).
  - Mobile browsers (e.g. iOS Safari) that evict `localStorage` after 7 days or under low-disk conditions must automatically restore credentials from `IndexedDB` during store hydration (`hydrate()`).
  - Credentials must NEVER be forgotten automatically; they can ONLY be erased when the user explicitly triggers "Disconnect Private Repository" in Settings.
- **Strict Fine-Grained Token Scoping**:
  - Storage repositories must be **Private** to ensure resume documents are never indexed publicly.
  - GitHub Personal Access Tokens must be **Fine-Grained**, scoped strictly to **"Only select repositories"** (their storage repo), with permissions limited to **Contents: Read and write**.
  - Setup and Settings screens must prominently explain these scope requirements so users understand that the token grants zero access to any other repositories.
- **No Embedded Credentials**:
  - NEVER hardcode personal GitHub tokens, Personal Access Tokens (PATs), usernames, or private repository names in source code or `DEFAULT_CONFIG`.
  - Client configuration must strictly read from `process.env.NEXT_PUBLIC_GITHUB_*` or user input stored in local browser storage.
  - When no configuration is provided, the application must cleanly route to `/setup` rather than falling back to hardcoded accounts.
- **Repository Sanitization**:
  - Binary user documents (`files/`, `thumbs/`) and personal `manifest.json` versions must never be tracked in the public git repository.
  - Maintain a clean `.env.example` documenting `NEXT_PUBLIC_GITHUB_OWNER`, `NEXT_PUBLIC_GITHUB_REPO`, and `NEXT_PUBLIC_GITHUB_TOKEN`.

## 8. User-Centric Visual Simplicity, Full Lifecycle & Multi-Branch Tree
- **Human-Friendly Terminology**:
  - Replace raw git terminal strings in the primary reading flow (e.g. `git branch --resumes`, raw commit hash as titles, `<checkout: main ▾>`) with intuitive labels ("stor.", "Add Resume", branch selector with color dot, human dates).
  - Technical metadata (integrity SHA, file size, format) belongs in secondary badges or inspection drawers, not primary titles.
- **Full Branch & Resume CRUD Lifecycle**:
  - Creating a branch must be 1 click away from headers, branch switchers, and tree graphs.
  - Deleting a branch must be supported with safety checks (prevent deleting the last remaining branch; reassign or trash orphan resumes; switch active branch).
  - Deleting any resume version must be immediately accessible from hero cards, viewers, and tree nodes with instant toast/undo feedback.
- **Accurate Multi-Branch Tree Visualization**:
  - Provide a full multi-branch tree view visualizing all branches diverging from root/main with SVG connecting lines and interactive resume nodes.
  - Must be fully phone-optimized with smooth touch-scrolling/panning, $\ge 44\text{px}$ touch targets, and fluid bottom sheets for actions.

## 9. `stor.` Minimal Aesthetic & UI Invariants
- **Strict No-Emoji Policy**:
  - Never use emojis anywhere in the application (no 🌿, 🧭, 📊, 💻, 🎨, etc.).
  - Represent branches, statuses, and categories using clean monochrome vector SVGs (`GitBranchIcon`, `FileText`, `Trash2`), crisp pill badges, or minimal 8px color dots (`w-2 h-2 rounded-full`).
- **Brand Identity**:
  - The application name is strictly **`stor.`** (lowercase with period).
  - Use clean, minimal typography without unnecessary subtext or decorative clutter.
- **Favicon & Brand Icon**:
  - All icons, favicons, and touch icons must follow the obsidian `#09090B` squircle with high-contrast white branching geometry and the signature white terminal dot (`.`).
- **Non-Redundant Controls**:
  - Keep action buttons singular and contextual. Never render duplicate action buttons (e.g. multiple "+ New Branch" triggers) within the same viewport.
- **Mathematical Timeline Alignment**:
  - In commit timelines (`BranchTreeVisualizer`), commit nodes and vertical lines must reside within a unified flex column (`w-5 flex flex-col items-center self-stretch`).
  - Suppress top line segment on the first item and bottom line segment on the last item to prevent dangling or broken line artifacts.

## 10. PWA Web Manifest & Mobile Installation Invariants
- **Icon Aesthetic**: All icons, favicons, and touch icons must follow the obsidian `#09090B` squircle with high-contrast white branching stem, commit nodes, and signature terminal dot. Never use legacy purple/indigo `#6366F1` or generic icons.
- **Standalone Display Mode**: The web manifest must specify `display: 'standalone'` and `theme_color: '#FFFFFF'` with portrait-primary orientation to enable a true native-app feel when added to home screens.
- **Installation Detection**:
  - Detect `window.matchMedia('(display-mode: standalone)').matches` and `(navigator as any).standalone === true`.
  - When installed / running in standalone mode, suppress install banners and prompts.
  - When running in browser on mobile/desktop, provide an intuitive "Install" trigger in the mobile header and Settings.
  - On iOS devices (where `beforeinstallprompt` is unavailable), provide clear 3-step visual guidance for Safari's "Add to Home Screen" action.
- **Mobile Form Ergonomics**: Prevent iOS Safari auto-zoom by ensuring input typography uses `text-base sm:text-xs` or proper viewport scaling.

## 11. GitHub Contents API Sync & Concurrency Invariants
- **CORS-Safe Cache-Busting**:
  - GitHub REST API restricts `Access-Control-Allow-Headers`. Never send custom `Cache-Control` or `Pragma` headers in client-side browser `fetch` requests as this causes CORS preflight rejection.
  - Bypass caching safely using the native fetch runtime flag `cache: 'no-store'` and dynamic query timestamp parameters (`?_ts=${Date.now()}`).
- **Semantic Change Detection**:
  - Never push `manifest.json` to GitHub unless there is an actual semantic change (e.g. outbox operations pending, or tracks/versions differing in IDs, labels, dates, or soft-delete statuses).
  - Do not trigger pushes on pure order/timestamp jitter or identical manifest data.
- **Branch Tombstones**:
  - `Branch` entities must support `deletedAt?: ISOTime | null` tombstones with newer `updatedAt` precedence in `mergeManifests`. Deleted branches must not resurrect during sync merges.
- **Single Root Sync Trigger Mounting**:
  - `setupSyncTriggers()` must be initialized exactly once per app session upon root store hydration. Never include `pathname` or route transitions in the sync registration lifecycle.
- **Silent Background Error Recovery**:
  - Background periodic syncs (60s timer and tab visibility change) must fail silently with exponential backoff and status dot updates.
  - User-facing error toasts (`Sync failed`) must be reserved for user-initiated actions (uploads, deletes, manual retry) where the user expects immediate feedback.

## 12. System Hardening, Memory Lifecycle & Security Invariants
- **PDF.js Memory Lifecycle**:
  - Any initialization of `pdfjs.getDocument()` (e.g. in thumbnail generation or document rendering) MUST invoke `pdf.destroy()` or `loadingTask.destroy()` inside a `finally` block.
  - Never retain uncollected WebAssembly or Canvas contexts in memory, as mobile devices will crash under multi-file stress.
- **Defensive Manifest & Date Parsing**:
  - Never assume `manifest.json` received over the wire is well-formed. Guard all `JSON.parse` operations against syntax errors.
  - All date comparisons and sorting functions (`compareVersionsDesc`, `mergeManifests`) must handle null, undefined, or malformed date strings defensively without throwing `TypeError`.
- **Path Sanitization & Traversal Prevention**:
  - All file paths passed to GitHub API or local caches must strip leading slashes and prevent directory traversal (`..`).
- **Semantic Diff Completeness**:
  - `hasSemanticManifestDiff()` must compare all mutable fields, including `tags`, `thumbPath`, `deletedAt`, and `order`. Never omit tags or secondary attributes from diff evaluation.
- **Zustand Synchronous State Commit**:
  - All store mutations (`addBranch`, `addVersion`, `updateBranch`, `deleteBranch`, `updateVersion`, `softDeleteVersion`, `restoreVersion`, `purgeVersion`, `emptyAllTrash`) must commit state synchronously to Zustand before awaiting asynchronous cache operations (such as IndexedDB writes) to prevent parallel mutation race conditions.
- **Purge Tombstone Registry**:
  - Permanently purged versions and tracks must be tracked in `manifest.purgedVersionIds` and `manifest.purgedTrackIds`.
  - `mergeManifests` must strictly exclude all purged IDs to prevent remote resurrection loops when merging manifests.
- **In-Flight Outbox Preservation**:
  - `sync()` finalization must only remove operations completed during the active sync cycle, preserving any newly queued user actions that arrived while the network request was in flight.

## 13. Dual-Remote Parity & Defense-in-Depth State Sanitization
- **Dual-Remote Parity**:
  - Whenever an application codebase has multiple git remotes (e.g. `origin` targeting the user's primary/deployed repo and `storr-public` targeting the open-source mirror), all production fixes MUST be synchronized to both remotes.
  - Never push fixes exclusively to an open-source mirror while leaving the primary deployed repository on stale code.
- **Data File Preservation During Code Merges**:
  - When updating branches that also serve as private GitHub storage repositories, never clobber or remove live storage directories (`files/` and `thumbs/`) or overwrite active manifest data.
- **Defense-in-Depth Selector Filtering**:
  - All store selectors (`selectTrashVersions`, `selectVersionsByTrack`, `selectBranchVersions`) must explicitly filter against `manifest.purgedVersionIds` to guarantee that purged items are excluded from rendering even if stale records temporarily linger in local cache.
- **UI Confirmation Busy Locking**:
  - All destructive modal or bottom sheet confirmation triggers (e.g. "Yes, Purge Forever", "Yes, Empty Trash") must implement busy/loading state locking (`isPurging`, `isPurgingAll`) to disable buttons and prevent double-clicks during debounced synchronization.

## 14. Dual-Codebase Architecture (`stor.` vs `storr.`)
- **Strict Identity Separation**:
  - **`stor.` (Personal Private Instance)**:
    - Repository Remote: `origin` (`https://github.com/Ameya79/resume-vault.git`).
    - Naming: strictly `stor.` (single 'r' with period).
    - Authentication: Hardcoded in `DEFAULT_CONFIG` (`Ameya79`, `resume-vault`, personal PAT).
    - Zero Setup Friction: Automatically mounts and syncs personal resumes on boot with no `/setup` prompt.
    - Data: Retains active PDF documents in `files/` and WebP thumbnails in `thumbs/`.
  - **`storr.` (Open Source Software / Public Template)**:
    - Repository Remote: `storr-public` (`https://github.com/Ameya79/storr.git`).
    - Naming: strictly `storr.` (double 'r' with period).
    - Authentication: Clean `DEFAULT_CONFIG` with empty strings. Never push personal secrets or PATs to prevent GitHub Push Protection blocks and credential leaks.
    - Setup Flow: Guides external users through `/setup` with instructions for scoped private repositories.
- **Cross-Remote Synchronization Protocol**:
  - Core engine enhancements (sync fixes, tombstone handling, UI components, tests) must be ported to both remotes.
  - When switching between remotes, enforce the respective `DEFAULT_CONFIG` and brand copy (`stor.` vs `storr.`) per remote.

## 15. Application Tracking & Career Links Invariants
- **Resume-Tied Application Tracking**:
  - Applications must be explicitly associated with a specific resume version (`versionId`).
  - Required fields: `id`, `versionId`, `company`, `role`, `status` (`applied` | `interviewing` | `offer` | `rejected` | `ghosted`), `appliedDate` (`YYYY-MM-DD`).
  - Status chips must use clean monochrome or minimal color dots (no emojis).
  - Placed prominently at the top of the resume detail view for rapid review during job searches.
- **Permanent Profile Links Storage**:
  - Dedicated storage in `Manifest.links` for core career URLs: `linkedin`, `github`, `portfolio`, `twitter`, and custom labeled links.
  - Dual-persisted across `localStorage` and `IndexedDB`, and synced to `manifest.json` on GitHub.
  - Links remain permanently stored until explicitly deleted or updated by the user.
  - Fast one-click copy capability to accelerate job application form completion.

## 16. Navigation Hierarchy, Tree Anchoring & Bespoke Tracker Invariants
- **Anti-Redundancy Navigation Hierarchy**:
  - The primary navigation bar (mobile bottom dock and desktop left rail) must strictly host root-level application contexts: `Home`, `Add Resume`, and `Settings`.
  - Never duplicate view modes into the navigation bar. Features with dedicated view switchers on the homepage (e.g. `[ Tree | Focused | Tracker ]`) must reside exclusively within the view switcher to avoid "double tabs" and visual clutter.
- **Tree View Application Anchoring**:
  - In visual tree graphs (`MultiBranchTreeGraph`) and commit timelines (`BranchTreeVisualizer`), any resume node with associated job applications must display the **latest place applied**: `{latestApp.company} · {latestApp.status}` (e.g. `Linear · Interviewing` or `Stripe · Applied`).
  - If multiple applications exist for that version, display a discreet supplementary count tag (`+2`).
- **High-Density Bespoke Reflog Tracker Aesthetic**:
  - Never render generic four-box SaaS admin metric dashboards or boilerplate cards.
  - Use a sleek, compact horizontal summary ribbon: `[ Total ] · [ Active (dot) ] · [ Offers (dot) ] · [ Applied (dot) ]`.
  - Application records must follow a high-density git-reflog aesthetic:
    - Tactile vertical stage indicator dot/line.
    - Prominent company and role typography with discreet external link triggers.
    - Attached resume version pill (`[BranchIcon] {branch.name} / {version.label}`) with 1-click preview link.
    - Inline tactile stage progression allowing 1-click status advances without opening edit modals.
    - Monospace notes block with clean indentation.
    - Seamless mobile touch responsiveness with zero awkward line breaks.
- **Mobile Thumbnail Aspect-Ratio Scaling**:
  - In card layouts (e.g. `HeroVersionCard`), never render oversized full-width preview rectangles on mobile devices.
  - Use compact, high-density media cards where a document aspect-ratio thumbnail (`w-20 h-28` to `w-24 h-32`) sits side-by-side with metadata and action chips.
- **Touch-Friendly Branch Carousel in Focused View**:
  - In Focused View on mobile, replace nested dropdown menus with a touch-swipeable horizontal branch carousel showing color indicators and commit counts. Switching active branches must be a 1-tap operation.
- **Strict Touch Target & Zero-Emoji Guardrails**:
  - All interactive elements must maintain $\ge 44\text{px}$ touch targets.
  - Maintain strictly zero emojis across all UI copy, badges, toasts, and code comments.

## 17. Zero-Flash Authentication & Setup Guard Invariants (FOUC Prevention)
- **Zero-Flash Unauthenticated Shell Guard**:
  - In open-source distributions (`storr.`), fresh browser sessions, or logged-out states, the application shell MUST NOT mount or pre-render internal application chrome (`TabBar`, desktop sidebar rails, mobile headers) or internal page content (`HomePage`, resume cards, search bars, profile link bars) before credentials have been verified.
  - When credentials are not verified and the active route is not `/setup`, the application shell must render a clean, brand-consistent blank canvas or minimal obsidian vault splash (`min-h-screen bg-canvas ... animate-pulse`) while verifying credentials or executing `router.replace('/setup')`.
  - Static HTML pre-rendered at build time on unconfigured instances must never bake internal dashboard components into `/`.
- **Synchronous Auth Hydration**:
  - If `DEFAULT_CONFIG` has hardcoded credentials (personal `stor.`) or `localStorage` contains a valid token (returning `storr.` user), authenticate synchronously on initial render with zero delay or splash.
  - If credentials must be restored from `IndexedDB`, hold the splash until the asynchronous restoration completes. Only reveal internal UI if valid credentials are recovered.
- **Dual-Distribution Branding Consistency**:
  - Personal private instance: strictly `stor.` (single 'r' with period).
  - Open source / public template: strictly `storr.` (double 'r' with period).
  - Ensure all titles, mobile headers, setup guides, and PWA prompts adhere strictly to their respective distribution identity.











