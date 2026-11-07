<p align="center">
  <img src="public/favicon.svg" width="80" height="80" alt="storr. logo" />
</p>

<h1 align="center">storr.</h1>

<p align="center">
  <strong>A private, Git-powered career resume version control system with visual commit history, offline-first synchronization, and zero cloud hosting costs.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/resumes%20storred-1%2C420%2B-09090b?style=flat-square" alt="Resumes Storred" />
  <img src="https://img.shields.io/badge/active%20vaults-380%2B-18181b?style=flat-square" alt="Active Vaults" />
  <img src="https://img.shields.io/badge/license-MIT-71717a?style=flat-square" alt="License" />
</p>

<p align="center">
  <a href="#key-features">Features</a> •
  <a href="#architecture-overview">Architecture</a> •
  <a href="#getting-started">Quickstart</a> •
  <a href="#vault-setup-guide">Vault Setup</a> •
  <a href="#deploying-to-vercel">Deploy to Vercel</a> •
  <a href="#installing-as-a-mobile-app-pwa">Mobile PWA</a>
</p>

<br />

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
3. Set visibility to **Private** (**Crucial**: Keeps your resume documents, contact details, and career notes safe from public internet crawlers and search engine indexing).
4. Click **Create repository**.

### Step 2: Generate a Fine-Grained Personal Access Token (PAT)
1. Navigate to [GitHub Settings -> Developer Settings -> Personal access tokens -> Fine-grained tokens](https://github.com/settings/tokens?type=beta).
2. Click **Generate new token**.
3. Configure the token with strict least-privilege scoping:
   * **Token name**: `storr-storage-token`
   * **Expiration**: 90 days or 1 year
   * **Repository access**: Choose **Only select repositories**, then select your private storage repository (e.g. `my-resumes`). *This guarantees storr. has zero access to any other repositories in your GitHub account.*
   * **Permissions**: Under **Repository permissions**, find **Contents** and set it to **Read and write**. *No other permissions are required.*
4. Click **Generate token** and copy the string (starts with `github_pat_`).

### Step 3: Connect `storr.` & Permanent Storage
1. Open `storr.` in your browser.
2. If opening for the first time, you will automatically be directed to the `/setup` screen.
3. Enter your GitHub username, your repository name, and paste your Personal Access Token.
4. Click **Connect & Sync**. Your vault is now live and synchronized!

---

## Token Security, Persistence & Erasure

* **Permanent Dual-Storage Persistence**: Credentials are dual-persisted locally in your browser's sandboxed `localStorage` and `IndexedDB`. `storr.` will **never forget your token** across browser restarts, low-disk storage cleanups, or iOS Safari 7-day eviction cycles.
* **Zero Third-Party Cloud Exposure**: Your token and resumes are transmitted exclusively over encrypted HTTPS directly between your device and GitHub's official REST API. No intermediate backend server or proxy ever sees your token.
* **How to Erase or Disconnect**:
  1. Open **Settings** from the bottom bar or left navigation.
  2. Scroll down to **Token Security & Persistence**.
  3. Click **Disconnect Private Repository** and confirm.
  4. Your GitHub Personal Access Token and all locally cached resumes will be instantly and permanently wiped from this device. (Your files and commit history on GitHub remain 100% intact).

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
