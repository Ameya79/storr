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
  - Replace raw git terminal strings in the primary reading flow (e.g. `git branch --resumes`, raw commit hash as titles, `<checkout: main ▾>`) with intuitive labels ("storr.", "Add Resume", branch selector with color dot, human dates).
  - Technical metadata (integrity SHA, file size, format) belongs in secondary badges or inspection drawers, not primary titles.
- **Full Branch & Resume CRUD Lifecycle**:
  - Creating a branch must be 1 click away from headers, branch switchers, and tree graphs.
  - Deleting a branch must be supported with safety checks (prevent deleting the last remaining branch; reassign or trash orphan resumes; switch active branch).
  - Deleting any resume version must be immediately accessible from hero cards, viewers, and tree nodes with instant toast/undo feedback.
- **Accurate Multi-Branch Tree Visualization**:
  - Provide a full multi-branch tree view visualizing all branches diverging from root/main with SVG connecting lines and interactive resume nodes.
  - Must be fully phone-optimized with smooth touch-scrolling/panning, $\ge 44\text{px}$ touch targets, and fluid bottom sheets for actions.

## 9. `storr.` Minimal Aesthetic & UI Invariants
- **Strict No-Emoji Policy**:
  - Never use emojis anywhere in the application (no 🌿, 🧭, 📊, 💻, 🎨, etc.).
  - Represent branches, statuses, and categories using clean monochrome vector SVGs (`GitBranchIcon`, `FileText`, `Trash2`), crisp pill badges, or minimal 8px color dots (`w-2 h-2 rounded-full`).
- **Brand Identity**:
  - The application name is strictly **`storr.`** (lowercase with period).
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







