# storr.

> A private, Git-powered career resume version control system with visual commit history, offline-first synchronization, and zero cloud hosting costs.

`storr.` treats your career documents like software repositories. Create branches for distinct roles (e.g., `product-lead`, `systems-architect`, `consulting`), commit chronological revisions with detailed notes, compare versions visually, and synchronize seamlessly across mobile and desktop devices using your own private GitHub repository as a zero-cost serverless vault.

---

## Key Features

* **Branch-Driven Version Control**: Manage customized resume variations by job track or seniority level. Switch branches, view commit trees, and track the evolution of each document over time.
* **Zero Backend Costs**: Runs entirely serverless. Your private GitHub repository serves as your database (`manifest.json`), document blob store (`files/`), and thumbnail store (`thumbs/`).
* **Client-Side PDF Pipeline**:
  * Calculates cryptographic SHA-256 integrity hashes in-browser via the Web Crypto API (`crypto.subtle`).
  * Renders page 1 of uploaded PDFs to an off-screen HTML canvas using `pdf.js` to produce a compressed 20 KB WebP thumbnail for instant mobile rendering.
* **Offline-First Resilience**: All metadata, manifests, and binary documents are cached in IndexedDB via `idb-keyval`. Full functionality remains available offline.
* **Two-Phase Concurrency Engine**:
  * Outbox queue batches pending changes.
  * Three-way manifest merging (`mergeManifests`) with Last-Write-Wins (LWW) conflict resolution and soft-delete tombstones.
  * Binary documents are committed prior to manifest updates to prevent broken links or partial states.
  * Automatic retry loop with jittered exponential backoff handles concurrent HTTP 409 conflict states.
* **Mobile PWA**: Installable Progressive Web App with service worker caching, safe-area viewport support, touch gestures, and responsive bottom sheets.
* **100% Data Sovereignty**: Your resumes, notes, and credentials never touch a proprietary third-party server. All data stays strictly between your device and your private GitHub repository.

---

## Architecture Overview

```
User Device (Browser / PWA)
│
├── UI Layer (Next.js 14 App Router, Tailwind CSS, Framer Motion)
├── PDF Pipeline (pdf.js canvas rendering -> 20 KB WebP thumbnail + SHA-256)
├── Local Storage (IndexedDB: Manifest, Outbox Queue, Binary Blobs)
│
└── Sync Engine (src/lib/sync.ts)
    │
    ▼ (HTTPS via GitHub REST Contents API)
Your Private GitHub Storage Repository
├── manifest.json            [Metadata Database: branches, versions, tags]
├── files/{id}.pdf           [Document Blob Store]
└── thumbs/{id}.webp         [Lightweight Preview Store]
```

---

## Getting Started

### Prerequisites

* Node.js 18.17 or higher
* npm, pnpm, or yarn
* A GitHub account

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/Ameya79/storr.git
cd storr
npm install
```

### 2. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Run the Test Suite

```bash
# Run unit and integration tests
npm test

# Run TypeScript typechecks
npm run typecheck

# Production build check
npm run build
```

---

## Vault Setup Guide

`storr.` synchronizes your data to a private GitHub repository you own. Follow these steps to connect your repository:

### Step 1: Create a Private GitHub Repository
1. Navigate to [github.com/new](https://github.com/new).
2. Enter a repository name (e.g. `my-resumes`).
3. Set visibility to **Private** (recommended to keep your resume and personal data secure).
4. Click **Create repository**.

### Step 2: Generate a Fine-Grained Personal Access Token (PAT)
1. Go to [GitHub Settings -> Developer Settings -> Personal access tokens -> Fine-grained tokens](https://github.com/settings/tokens?type=beta).
2. Click **Generate new token**.
3. Fill in the token details:
   * **Token name**: `storr-storage-token`
   * **Expiration**: 90 days or 1 year
   * **Repository access**: Choose **Only select repositories**, then select your private repository (e.g. `my-resumes`).
   * **Permissions**: Under **Repository permissions**, find **Contents** and set it to **Read and write**.
4. Click **Generate token** and copy the string (starts with `github_pat_`).

### Step 3: Connect `storr.`
1. Open `storr.` in your browser.
2. If opening for the first time, you will automatically be directed to the `/setup` screen.
3. Enter your GitHub username, your repository name, and paste your Personal Access Token.
4. Click **Connect & Sync**. Your vault is now live and synchronized!

---

## Deploying to Vercel

You can host your own instance of `storr.` on Vercel with zero configuration:

1. Fork or push this repository to your GitHub account.
2. Go to [vercel.com](https://vercel.com) and click **Add New Project**.
3. Import your `storr` repository.
4. *(Optional)* Set environment variables if you want credentials pre-loaded on deployment:
   * `NEXT_PUBLIC_GITHUB_OWNER`
   * `NEXT_PUBLIC_GITHUB_REPO`
   * `NEXT_PUBLIC_GITHUB_TOKEN`
5. Click **Deploy**. Vercel will build and serve your app globally.

---

## Multi-Device Sync & Setup Code

To connect your phone or a second computer without retyping your GitHub token:

1. On your configured desktop device, open **Settings**.
2. Click **Copy setup code**. (This exports a compact, URL-safe base64 string containing your repository and token configuration).
3. Open `storr.` on your mobile browser, go to `/setup`, tap **Paste Setup Code**, and click **Connect**.
4. Both devices will now synchronize to the same private GitHub vault.

---

## Installing as a Mobile App (PWA)

`storr.` is a Progressive Web App that works offline and launches full-screen:

* **iOS (Safari)**:
  1. Open your `storr.` URL in Safari.
  2. Tap the **Share** button in the bottom toolbar.
  3. Scroll down and select **Add to Home Screen**.
* **Android (Chrome)**:
  1. Open your `storr.` URL in Chrome.
  2. Tap the three-dot menu in the top right.
  3. Tap **Install app** (or use the in-app install prompt).

---

## Technical Stack

* **Framework**: Next.js 14 (App Router)
* **Language**: TypeScript
* **State Management**: Zustand with custom IndexedDB middleware
* **Offline Persistence**: `idb-keyval` (IndexedDB)
* **Document Processing**: `pdf.js` (Mozilla PDF rendering engine)
* **Styling**: Tailwind CSS
* **Animations**: Framer Motion
* **Testing**: Vitest with `@testing-library/react` and happy-dom
* **Service Worker**: Native PWA Service Worker (`/sw.js`)

---

## License

MIT License. Free and open source for personal and commercial use.
