import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { useVault, createDefaultManifest } from '@/store/useVault';
import {
  setCachedManifest,
  getCachedManifest,
  setCachedOutbox,
  getCachedOutbox,
  setCachedBlob,
  getCachedBlob,
} from '@/lib/cache';
import { sync } from '@/lib/sync';
import * as github from '@/lib/github';
import * as configLib from '@/lib/config';
import { ReplaceResumeModal } from '@/components/ReplaceResumeModal';
import { HeroVersionCard } from '@/components/HeroVersionCard';
import { BranchTreeVisualizer } from '@/components/BranchTreeVisualizer';
import { Branch, Version } from '@/types';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}));

// Mock pdf makeThumbnail
vi.mock('@/lib/pdf', () => ({
  makeThumbnail: vi.fn(async () => new Blob(['fake-thumbnail'], { type: 'image/webp' })),
  renderPages: vi.fn(async () => () => {}),
}));

// Mock ToastContainer showToast
vi.mock('@/components/ToastContainer', () => ({
  showToast: vi.fn(),
}));

describe('Replace Resume Feature - End-to-End Suite', () => {
  const dummyBranch: Branch = {
    id: 'b-main',
    name: 'main',
    color: '#18181B',
    order: 0,
    archived: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  };

  const initialVersion: Version = {
    id: 'v-original',
    trackId: 'b-main',
    label: 'Initial Software Engineer Resume',
    versionDate: '2026-11-01',
    fileName: 'original_resume.pdf',
    mime: 'application/pdf',
    sizeBytes: 15000,
    sha256: 'sha-original-123',
    filePath: 'files/original.pdf',
    thumbPath: 'thumbs/original.webp',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    deletedAt: null,
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    const manifest = {
      schema: 1 as const,
      updatedAt: '2026-11-01T00:00:00.000Z',
      tracks: [dummyBranch],
      versions: [{ ...initialVersion }],
      applications: [
        {
          id: 'app-1',
          versionId: 'v-original',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          status: 'applied' as const,
          appliedDate: '2026-11-02',
          createdAt: '2026-11-02T00:00:00.000Z',
          updatedAt: '2026-11-02T00:00:00.000Z',
        },
      ],
    };

    useVault.setState({
      manifest,
      manifestSha: 'sha-test-0',
      outbox: [],
      syncStatus: 'synced',
      lastSyncAt: null,
      isHydrated: true,
      activeBranchId: dummyBranch.id,
    });

    await setCachedManifest(manifest);
    await setCachedOutbox([]);
    await setCachedBlob('files/original.pdf', new Uint8Array([1, 2, 3]));
    await setCachedBlob('thumbs/original.webp', new Uint8Array([4, 5, 6]));
  });

  describe('1. Store replaceVersion action', () => {
    it('replaces resume content, updates title, and updates timestamps', async () => {
      const updated = await useVault.getState().replaceVersion('v-original', {
        label: 'Updated Senior Engineer Resume',
        fileName: 'new_senior_resume.pdf',
        mime: 'application/pdf',
        sizeBytes: 30000,
        sha256: 'sha-new-456',
        filePath: 'files/new-file.pdf',
        thumbPath: 'thumbs/new-thumb.webp',
      });

      expect(updated.id).toBe('v-original');
      expect(updated.label).toBe('Updated Senior Engineer Resume');
      expect(updated.fileName).toBe('new_senior_resume.pdf');
      expect(updated.sizeBytes).toBe(30000);
      expect(updated.sha256).toBe('sha-new-456');
      expect(updated.filePath).toBe('files/new-file.pdf');
      expect(updated.thumbPath).toBe('thumbs/new-thumb.webp');
      expect(new Date(updated.updatedAt).getTime()).toBeGreaterThanOrEqual(
        new Date(initialVersion.updatedAt).getTime()
      );

      const state = useVault.getState();
      const currentVersion = state.manifest?.versions.find((v) => v.id === 'v-original');
      expect(currentVersion?.label).toBe('Updated Senior Engineer Resume');

      // Verify associated application retains linkage to same version ID
      const app = state.manifest?.applications?.find((a) => a.id === 'app-1');
      expect(app?.versionId).toBe('v-original');
    });

    it('enqueues UPLOAD_BLOB for new files and DELETE_BLOB for old files to eliminate orphans', async () => {
      await useVault.getState().replaceVersion('v-original', {
        label: 'Renamed Resume',
        fileName: 'replacement.docx',
        mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        sizeBytes: 25000,
        sha256: 'sha-docx-789',
        filePath: 'files/replacement.docx',
        thumbPath: null,
      });

      const outbox = useVault.getState().outbox;

      // Must upload the new file
      const uploadOps = outbox.filter((o) => o.type === 'UPLOAD_BLOB');
      expect(uploadOps.some((o) => o.path === 'files/replacement.docx')).toBe(true);

      // Must delete old files from Git tree to prevent orphaned files
      const deleteOps = outbox.filter((o) => o.type === 'DELETE_BLOB');
      expect(deleteOps.some((o) => o.path === 'files/original.pdf')).toBe(true);
      expect(deleteOps.some((o) => o.path === 'thumbs/original.webp')).toBe(true);

      // Must upsert version in manifest
      const upsertOp = outbox.find((o) => o.type === 'UPSERT_VERSION' && o.id === 'v-original');
      expect(upsertOp).toBeDefined();

      // Old cached blob in IndexedDB should be evicted
      const oldBlob = await getCachedBlob('files/original.pdf');
      expect(oldBlob).toBeNull();
    });

    it('removes pending UPLOAD_BLOB for old paths if still in outbox', async () => {
      // Simulate adding a version whose files have not synced to remote yet
      const added = await useVault.getState().addVersion({
        trackId: 'b-main',
        label: 'Pending Sync Resume',
        versionDate: '2026-11-06',
        fileName: 'pending.pdf',
        mime: 'application/pdf',
        sizeBytes: 12000,
        sha256: 'sha-pending',
        filePath: 'files/pending.pdf',
        thumbPath: 'thumbs/pending.webp',
      });

      let outbox = useVault.getState().outbox;
      expect(outbox.some((o) => o.type === 'UPLOAD_BLOB' && o.path === 'files/pending.pdf')).toBe(true);

      // Replace before sync completes
      await useVault.getState().replaceVersion(added.id, {
        label: 'Replaced Before Sync',
        fileName: 'replaced_now.pdf',
        mime: 'application/pdf',
        sizeBytes: 18000,
        sha256: 'sha-replaced-now',
        filePath: 'files/replaced_now.pdf',
        thumbPath: 'thumbs/replaced_now.webp',
      });

      outbox = useVault.getState().outbox;
      // Pending UPLOAD_BLOB for unsynced files/pending.pdf must have been canceled
      expect(outbox.some((o) => o.type === 'UPLOAD_BLOB' && o.path === 'files/pending.pdf')).toBe(false);
      // New UPLOAD_BLOB must be present
      expect(outbox.some((o) => o.type === 'UPLOAD_BLOB' && o.path === 'files/replaced_now.pdf')).toBe(true);
    });

    it('throws error when replacing non-existent version ID', async () => {
      await expect(
        useVault.getState().replaceVersion('v-does-not-exist', {
          label: 'Ghost',
          fileName: 'ghost.pdf',
          mime: 'application/pdf',
          sizeBytes: 1000,
          sha256: 'sha-ghost',
          filePath: 'files/ghost.pdf',
          thumbPath: null,
        })
      ).rejects.toThrow('Version with ID "v-does-not-exist" not found');
    });
  });

  describe('2. Dual-Persistence (IndexedDB + localStorage)', () => {
    it('persists updated resume and title across IndexedDB and localStorage', async () => {
      await useVault.getState().replaceVersion('v-original', {
        label: 'Dual Persistence Verified Title',
        fileName: 'dual_verify.pdf',
        mime: 'application/pdf',
        sizeBytes: 42000,
        sha256: 'sha-dual',
        filePath: 'files/dual.pdf',
        thumbPath: null,
      });

      // Check localStorage
      const localRaw = localStorage.getItem('rv:manifest');
      expect(localRaw).not.toBeNull();
      const localManifest = JSON.parse(localRaw!);
      expect(
        localManifest.versions.some(
          (v: Version) => v.id === 'v-original' && v.label === 'Dual Persistence Verified Title'
        )
      ).toBe(true);

      // Check IndexedDB
      const idbManifest = await getCachedManifest();
      expect(
        idbManifest?.versions.some(
          (v: Version) => v.id === 'v-original' && v.label === 'Dual Persistence Verified Title'
        )
      ).toBe(true);
    });

    it('recovers manifest from localStorage if IndexedDB is cleared', async () => {
      const manifest = useVault.getState().manifest!;
      await setCachedManifest(manifest);

      // Simulate browser clearing IndexedDB while localStorage remains
      const idbStore = (await import('idb-keyval')) as unknown as {
        del: (k: string) => Promise<void>;
      };
      await idbStore.del('rv:manifest');

      const recovered = await getCachedManifest();
      expect(recovered).not.toBeNull();
      expect(recovered?.versions[0].id).toBe('v-original');
    });
  });

  describe('3. Remote Git Tree Synchronization', () => {
    it('triggers clean Git tree sync uploading replacement and deleting old file without orphans', async () => {
      vi.spyOn(configLib, 'getConfig').mockReturnValue({
        owner: 'testowner',
        repo: 'testrepo',
        token: 'testtoken',
      });

      const putFileSpy = vi.spyOn(github, 'putFile').mockImplementation(async (path) => {
        if (path === 'manifest.json') return 'sha-manifest-new';
        return `sha-blob-${path}`;
      });

      const deleteFileSpy = vi.spyOn(github, 'deleteFile').mockResolvedValue();

      vi.spyOn(github, 'getFileMetadata').mockImplementation(async (path) => ({
        sha: `sha-meta-${path}`,
        size: 1000,
        name: path,
        path,
      }));

      vi.spyOn(github, 'getManifest').mockResolvedValue({
        manifest: useVault.getState().manifest!,
        sha: 'sha-test-0',
      });

      // Prepare replacement
      const newFileBytes = new Uint8Array([10, 20, 30, 40]);
      await setCachedBlob('files/replacement-sync.pdf', newFileBytes);

      await useVault.getState().replaceVersion('v-original', {
        label: 'Synchronized Resume',
        fileName: 'replacement-sync.pdf',
        mime: 'application/pdf',
        sizeBytes: newFileBytes.length,
        sha256: 'sha-replacement-sync',
        filePath: 'files/replacement-sync.pdf',
        thumbPath: null,
      });

      // Trigger sync
      await sync();

      // Verify new blob uploaded
      expect(putFileSpy).toHaveBeenCalledWith(
        'files/replacement-sync.pdf',
        expect.anything(),
        expect.objectContaining({ message: expect.stringContaining('Upload files/replacement-sync.pdf') })
      );

      // Verify old blobs deleted from Git tree to prevent orphans
      expect(deleteFileSpy).toHaveBeenCalledWith(
        'files/original.pdf',
        'sha-meta-files/original.pdf',
        expect.stringContaining('Delete files/original.pdf')
      );
      expect(deleteFileSpy).toHaveBeenCalledWith(
        'thumbs/original.webp',
        'sha-meta-thumbs/original.webp',
        expect.stringContaining('Delete thumbs/original.webp')
      );

      // Verify manifest was pushed
      const manifestCall = putFileSpy.mock.calls.find((call) => call[0] === 'manifest.json');
      expect(manifestCall).toBeDefined();
      expect(manifestCall![2]).toEqual(
        expect.objectContaining({ message: expect.stringContaining('Update manifest') })
      );

      // Outbox must be completely drained
      expect(useVault.getState().outbox.length).toBe(0);
      expect(useVault.getState().syncStatus).toBe('synced');
    });
  });

  describe('4. ReplaceResumeModal UI and Component Flow', () => {
    it('renders modal with file picker, editable title, and enforces 44px touch targets', () => {
      render(
        <ReplaceResumeModal
          isOpen={true}
          version={initialVersion}
          onClose={vi.fn()}
        />
      );

      expect(screen.getByRole('heading', { name: 'Replace Resume' })).toBeInTheDocument();
      const titleInput = screen.getByLabelText(/Resume Name \/ Title/i) as HTMLInputElement;
      expect(titleInput).toBeInTheDocument();
      expect(titleInput.value).toBe(initialVersion.label);

      // Interactive buttons verification (44px touch targets)
      const closeBtn = screen.getByLabelText('Close replace modal');
      expect(closeBtn.className).toMatch(/min-h-\[44px\]|h-11/);
      expect(closeBtn.className).toMatch(/min-w-\[44px\]|w-11/);

      const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
      expect(cancelBtn.className).toMatch(/min-h-\[44px\]/);
      expect(cancelBtn.className).toMatch(/min-w-\[44px\]/);

      const submitBtn = screen.getByRole('button', { name: /Replace Resume/i });
      expect(submitBtn.className).toMatch(/min-h-\[44px\]/);
      expect(submitBtn.className).toMatch(/min-w-\[44px\]/);
    });

    it('validates file type and rejects unsupported files', async () => {
      render(
        <ReplaceResumeModal
          isOpen={true}
          version={initialVersion}
          onClose={vi.fn()}
        />
      );

      const hiddenInput = document.getElementById('replacement-file-input') as HTMLInputElement;
      const invalidFile = new File(['bad'], 'notes.txt', { type: 'text/plain' });

      await act(async () => {
        fireEvent.change(hiddenInput, { target: { files: [invalidFile] } });
      });

      expect(screen.getByText(/Only PDF and DOCX files are supported/i)).toBeInTheDocument();
    });

    it('accepts valid PDF, updates title field, and executes replacement upon submit', async () => {
      const handleReplaced = vi.fn();
      const handleClose = vi.fn();

      render(
        <ReplaceResumeModal
          isOpen={true}
          version={initialVersion}
          onClose={handleClose}
          onReplaced={handleReplaced}
        />
      );

      const hiddenInput = document.getElementById('replacement-file-input') as HTMLInputElement;
      const validPdf = new File(['%PDF-1.4 mock content'], 'Senior_Engineer_2026.pdf', {
        type: 'application/pdf',
      });

      await act(async () => {
        fireEvent.change(hiddenInput, { target: { files: [validPdf] } });
      });

      // Title auto-suggested or editable
      const titleInput = screen.getByLabelText(/Resume Name \/ Title/i) as HTMLInputElement;
      expect(titleInput.value).toBe('Senior Engineer 2026');

      // Edit title
      await act(async () => {
        fireEvent.change(titleInput, { target: { value: 'Confirmed Executive Resume' } });
      });
      expect(titleInput.value).toBe('Confirmed Executive Resume');

      // Submit form
      const submitBtn = screen.getByRole('button', { name: /Replace Resume/i });
      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(handleReplaced).toHaveBeenCalledTimes(1);
      });
      expect(handleClose).toHaveBeenCalledTimes(1);

      const updatedInStore = useVault
        .getState()
        .manifest?.versions.find((v) => v.id === initialVersion.id);
      expect(updatedInStore?.label).toBe('Confirmed Executive Resume');
      expect(updatedInStore?.fileName).toBe('Senior_Engineer_2026.pdf');
    });
  });

  describe('5. Card replace buttons & Zero-Emoji Guardrail', () => {
    it('HeroVersionCard displays dedicated replace button with 44px target', async () => {
      render(
        <HeroVersionCard
          branch={dummyBranch}
          version={initialVersion}
          totalCommits={1}
        />
      );

      const replaceBtn = screen.getByTitle('Replace resume');
      expect(replaceBtn).toBeInTheDocument();
      expect(replaceBtn.className).toMatch(/min-h-\[44px\]/);

      // Clicking replace opens ReplaceResumeModal
      await act(async () => {
        fireEvent.click(replaceBtn);
      });

      expect(screen.getByRole('heading', { name: 'Replace Resume' })).toBeInTheDocument();
    });

    it('BranchTreeVisualizer displays dedicated replace button with 44px target for each entry', async () => {
      render(
        <BranchTreeVisualizer
          branch={dummyBranch}
          versions={[initialVersion]}
        />
      );

      const replaceBtn = screen.getByTitle('Replace resume');
      expect(replaceBtn).toBeInTheDocument();
      expect(replaceBtn.className).toMatch(/min-h-\[44px\]|h-11/);
      expect(replaceBtn.className).toMatch(/min-w-\[44px\]|w-11/);

      await act(async () => {
        fireEvent.click(replaceBtn);
      });

      expect(screen.getByRole('heading', { name: 'Replace Resume' })).toBeInTheDocument();
    });

    it('strictly satisfies zero emojis guardrail across new and modified components', async () => {
      // Regex for emoji characters
      const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;

      const fs = await import('fs');
      const path = await import('path');

      const filesToCheck = [
        'components/ReplaceResumeModal.tsx',
        'components/HeroVersionCard.tsx',
        'components/BranchTreeVisualizer.tsx',
        'components/MultiBranchTreeGraph.tsx',
        'src/store/useVault.ts',
        'src/lib/cache.ts',
        'app/view/[versionId]/page.tsx',
        'app/branch/[id]/page.tsx',
      ];

      for (const relPath of filesToCheck) {
        const fullPath = path.resolve(process.cwd(), relPath);
        if (fs.existsSync(fullPath)) {
          const content = fs.readFileSync(fullPath, 'utf8');
          expect(emojiRegex.test(content)).toBe(false);
        }
      }
    });
  });
});
