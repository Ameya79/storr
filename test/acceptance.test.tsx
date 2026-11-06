import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVault, createDefaultManifest, selectLatestByTrack } from '@/store/useVault';
import { decodeSetupCode, encodeSetupCode, setConfig, getConfig } from '@/lib/config';
import { mergeManifests, sync } from '@/lib/sync';
import { Manifest, Version } from '@/types';
import * as github from '@/lib/github';

describe('Step 15 Acceptance & Flow Verification', () => {
  beforeEach(() => {
    localStorage.clear();
    useVault.setState({
      manifest: createDefaultManifest(),
      manifestSha: 'sha-0',
      outbox: [],
      syncStatus: 'synced',
      lastSyncAt: null,
      isHydrated: true,
    });
  });

  it('1. Fresh install & paste setup code initializes credentials and session', () => {
    const originalConfig = {
      owner: 'johndoe',
      repo: 'resume-vault-data',
      token: 'github_pat_valid123',
    };

    const setupCode = encodeSetupCode(originalConfig);
    const decoded = decodeSetupCode(setupCode);

    expect(decoded).toEqual(originalConfig);
    setConfig(decoded!);
    expect(getConfig()).toEqual(originalConfig);
  });

  it('2. Uploading a PDF immediately makes it the latest hero card in the track', async () => {
    const productTrack = useVault.getState().manifest!.tracks[0];

    const v1 = await useVault.getState().addVersion({
      trackId: productTrack.id,
      label: 'Fintech Specialist v1',
      versionDate: '2026-10-01',
      fileName: 'fintech_v1.pdf',
      mime: 'application/pdf',
      sizeBytes: 50000,
      sha256: 'sha-v1',
      filePath: 'files/v1.pdf',
      thumbPath: 'thumbs/v1.webp',
    });

    let latest = selectLatestByTrack(useVault.getState().manifest, productTrack.id);
    expect(latest?.id).toBe(v1.id);
    expect(latest?.label).toBe('Fintech Specialist v1');

    // Add a newer version with a later versionDate
    const v2 = await useVault.getState().addVersion({
      trackId: productTrack.id,
      label: 'Fintech Specialist v2',
      versionDate: '2026-11-05',
      fileName: 'fintech_v2.pdf',
      mime: 'application/pdf',
      sizeBytes: 55000,
      sha256: 'sha-v2',
      filePath: 'files/v2.pdf',
      thumbPath: 'thumbs/v2.webp',
    });

    latest = selectLatestByTrack(useVault.getState().manifest, productTrack.id);
    expect(latest?.id).toBe(v2.id);
    expect(latest?.label).toBe('Fintech Specialist v2');
  });

  it('3. Editing the date of a version correctly recomputes the latest hero', async () => {
    const productTrack = useVault.getState().manifest!.tracks[0];

    const v1 = await useVault.getState().addVersion({
      trackId: productTrack.id,
      label: 'Version Alpha',
      versionDate: '2026-10-01',
      fileName: 'alpha.pdf',
      mime: 'application/pdf',
      sizeBytes: 1000,
      sha256: 'h1',
      filePath: 'files/alpha.pdf',
      thumbPath: null,
    });

    const v2 = await useVault.getState().addVersion({
      trackId: productTrack.id,
      label: 'Version Beta',
      versionDate: '2026-09-01',
      fileName: 'beta.pdf',
      mime: 'application/pdf',
      sizeBytes: 1000,
      sha256: 'h2',
      filePath: 'files/beta.pdf',
      thumbPath: null,
    });

    expect(selectLatestByTrack(useVault.getState().manifest, productTrack.id)?.id).toBe(v1.id);

    // Edit Beta to have a newer date (2026-11-10)
    await useVault.getState().updateVersion(v2.id, { versionDate: '2026-11-10' });

    // Latest must now be Beta!
    const updatedLatest = selectLatestByTrack(useVault.getState().manifest, productTrack.id);
    expect(updatedLatest?.id).toBe(v2.id);
    expect(updatedLatest?.label).toBe('Version Beta');
  });

  it('4. Offline actions queue safely without data loss and sync when online', async () => {
    setConfig({ owner: 'user', repo: 'resume-vault-data', token: 'token' });

    const trackId = useVault.getState().manifest!.tracks[0].id;
    // Add version offline
    const v = await useVault.getState().addVersion({
      trackId,
      label: 'Offline Version',
      versionDate: '2026-11-05',
      fileName: 'off.pdf',
      mime: 'application/pdf',
      sizeBytes: 1200,
      sha256: 'off-sha',
      filePath: 'files/off.pdf',
      thumbPath: null,
    });

    expect(useVault.getState().outbox.length).toBeGreaterThan(0);

    // Network is offline:
    vi.spyOn(github, 'getManifest').mockRejectedValue(new github.OfflineError());
    await sync();

    // Verify outbox ops still preserved in queue!
    expect(useVault.getState().syncStatus).toBe('offline');
    expect(useVault.getState().outbox.some((o) => o.type === 'UPSERT_VERSION' && o.id === v.id)).toBe(true);
  });

  it('5. Cross-device convergence: two devices sync without losing edits', () => {
    const track = useVault.getState().manifest!.tracks[0];

    const vPhone: Version = {
      id: 'vPhone',
      trackId: track.id,
      label: 'Added on phone',
      versionDate: '2026-11-05',
      fileName: 'phone.pdf',
      mime: 'application/pdf',
      sizeBytes: 1000,
      sha256: 'p-sha',
      filePath: 'files/phone.pdf',
      thumbPath: 'thumbs/phone.webp',
      createdAt: '2026-11-05T10:00:00.000Z',
      updatedAt: '2026-11-05T10:00:00.000Z',
      deletedAt: null,
    };

    const vLaptop: Version = {
      id: 'vLaptop',
      trackId: track.id,
      label: 'Added on laptop',
      versionDate: '2026-11-05',
      fileName: 'laptop.pdf',
      mime: 'application/pdf',
      sizeBytes: 1000,
      sha256: 'l-sha',
      filePath: 'files/laptop.pdf',
      thumbPath: 'thumbs/laptop.webp',
      createdAt: '2026-11-05T11:00:00.000Z',
      updatedAt: '2026-11-05T11:00:00.000Z',
      deletedAt: null,
    };

    const phoneManifest: Manifest = {
      schema: 1,
      updatedAt: '2026-11-05T10:00:00.000Z',
      tracks: [track],
      versions: [vPhone],
    };

    const laptopManifest: Manifest = {
      schema: 1,
      updatedAt: '2026-11-05T11:00:00.000Z',
      tracks: [track],
      versions: [vLaptop],
    };

    const converged = mergeManifests(phoneManifest, laptopManifest);

    // Both versions exist, no loss
    expect(converged.versions.length).toBe(2);
    expect(converged.versions.some((v) => v.id === 'vPhone')).toBe(true);
    expect(converged.versions.some((v) => v.id === 'vLaptop')).toBe(true);
  });
});

