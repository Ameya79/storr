import { describe, it, expect, beforeEach } from 'vitest';
import { useVault, createDefaultManifest, selectApplicationsByVersion, selectProfileLinks } from '@/store/useVault';
import { mergeManifests, hasSemanticManifestDiff } from '@/lib/sync';
import { Manifest, Application, ProfileLinks } from '@/types';

describe('Application Tracking and Profile Links unit tests', () => {
  beforeEach(() => {
    localStorage.clear();
    const manifest = createDefaultManifest();
    useVault.setState({
      manifest,
      outbox: [],
    });
  });

  it('adds an application linked to a specific resume version', async () => {
    const versionId = 'ver-123';
    const app = await useVault.getState().addApplication({
      versionId,
      company: 'Acme Corp',
      role: 'Staff Engineer',
      status: 'applied',
      appliedDate: '2026-11-09',
      jobUrl: 'https://acme.careers/123',
      notes: 'Applied through referral.',
    });

    expect(app.id).toBeDefined();
    expect(app.versionId).toBe(versionId);
    expect(app.company).toBe('Acme Corp');
    expect(app.status).toBe('applied');

    const manifest = useVault.getState().manifest;
    expect(manifest?.applications).toHaveLength(1);
    expect(manifest?.applications?.[0].id).toBe(app.id);

    const versionApps = selectApplicationsByVersion(manifest, versionId);
    expect(versionApps).toHaveLength(1);
    expect(versionApps[0].company).toBe('Acme Corp');

    // Searching for another version ID returns empty
    const otherApps = selectApplicationsByVersion(manifest, 'other-version');
    expect(otherApps).toHaveLength(0);
  });

  it('updates an existing application status and details', async () => {
    const versionId = 'ver-456';
    const app = await useVault.getState().addApplication({
      versionId,
      company: 'Stripe',
      role: 'Software Engineer',
      status: 'applied',
      appliedDate: '2026-11-01',
    });

    await useVault.getState().updateApplication(app.id, {
      status: 'interviewing',
      notes: 'Recruiter screen scheduled for tomorrow.',
    });

    const manifest = useVault.getState().manifest;
    const updated = manifest?.applications?.find((a) => a.id === app.id);
    expect(updated?.status).toBe('interviewing');
    expect(updated?.notes).toContain('Recruiter screen');
  });

  it('deletes an application', async () => {
    const app1 = await useVault.getState().addApplication({
      versionId: 'ver-789',
      company: 'Google',
      role: 'L5 SDE',
      status: 'applied',
      appliedDate: '2026-11-05',
    });
    const app2 = await useVault.getState().addApplication({
      versionId: 'ver-789',
      company: 'Meta',
      role: 'E5 SDE',
      status: 'applied',
      appliedDate: '2026-11-06',
    });

    let manifest = useVault.getState().manifest;
    expect(manifest?.applications).toHaveLength(2);

    await useVault.getState().deleteApplication(app1.id);
    manifest = useVault.getState().manifest;
    expect(manifest?.applications).toHaveLength(1);
    expect(manifest?.applications?.[0].company).toBe('Meta');
  });

  it('manages permanent career profile links', async () => {
    const links: ProfileLinks = {
      linkedin: 'https://linkedin.com/in/vinay-dev',
      github: 'https://github.com/Ameya79',
      portfolio: 'https://vinay.design',
      twitter: 'https://x.com/vinay',
      custom: [{ id: '1', label: 'Substack', url: 'https://vinay.substack.com' }],
    };

    await useVault.getState().updateProfileLinks(links);

    const manifest = useVault.getState().manifest;
    expect(manifest?.links?.linkedin).toBe('https://linkedin.com/in/vinay-dev');
    expect(manifest?.links?.github).toBe('https://github.com/Ameya79');
    expect(manifest?.links?.custom).toHaveLength(1);

    const selected = selectProfileLinks(manifest);
    expect(selected.linkedin).toBe('https://linkedin.com/in/vinay-dev');

    // Dual-persists to localStorage
    const local = localStorage.getItem('stor.links');
    expect(local).toBeTruthy();
    expect(JSON.parse(local!).portfolio).toBe('https://vinay.design');
  });

  it('three-way merges applications using Last-Write-Wins and drops purged versions', () => {
    const baseLocal: Manifest = {
      ...createDefaultManifest(),
      purgedVersionIds: ['purged-ver-999'],
      applications: [
        {
          id: 'app-1',
          versionId: 'ver-active',
          company: 'Figma',
          role: 'Product Engineer',
          status: 'applied',
          appliedDate: '2026-11-01',
          createdAt: '2026-11-01T10:00:00.000Z',
          updatedAt: '2026-11-01T10:00:00.000Z',
        },
        {
          id: 'app-orphan',
          versionId: 'purged-ver-999',
          company: 'Ghost Co',
          role: 'Old Role',
          status: 'rejected',
          appliedDate: '2026-10-01',
          createdAt: '2026-10-01T10:00:00.000Z',
          updatedAt: '2026-10-01T10:00:00.000Z',
        },
      ],
    };

    const baseRemote: Manifest = {
      ...createDefaultManifest(),
      applications: [
        {
          id: 'app-1',
          versionId: 'ver-active',
          company: 'Figma',
          role: 'Senior Product Engineer',
          status: 'interviewing',
          appliedDate: '2026-11-01',
          createdAt: '2026-11-01T10:00:00.000Z',
          updatedAt: '2026-11-05T12:00:00.000Z', // Remote is newer
        },
        {
          id: 'app-2',
          versionId: 'ver-active',
          company: 'Linear',
          role: 'Frontend Lead',
          status: 'offer',
          appliedDate: '2026-11-02',
          createdAt: '2026-11-02T10:00:00.000Z',
          updatedAt: '2026-11-02T10:00:00.000Z',
        },
      ],
      links: {
        linkedin: 'https://linkedin.com/in/remotelink',
        github: 'https://github.com/remoteuser',
      },
    };

    const merged = mergeManifests(baseLocal, baseRemote);

    // app-orphan must be excluded because version 'purged-ver-999' was purged
    expect(merged.applications?.find((a) => a.id === 'app-orphan')).toBeUndefined();

    // app-1 remote updated is newer (Senior Product Engineer, interviewing)
    const app1 = merged.applications?.find((a) => a.id === 'app-1');
    expect(app1?.role).toBe('Senior Product Engineer');
    expect(app1?.status).toBe('interviewing');

    // app-2 from remote is included
    const app2 = merged.applications?.find((a) => a.id === 'app-2');
    expect(app2?.company).toBe('Linear');

    // Links are preserved
    expect(merged.links?.linkedin).toBe('https://linkedin.com/in/remotelink');
  });

  it('detects semantic diffs when applications or profile links are modified', () => {
    const m1 = createDefaultManifest();
    const m2: Manifest = {
      ...m1,
      applications: [
        {
          id: 'app-x',
          versionId: 'v-1',
          company: 'Apple',
          role: 'iOS Engineer',
          status: 'applied',
          appliedDate: '2026-11-08',
          createdAt: '2026-11-08T10:00:00.000Z',
          updatedAt: '2026-11-08T10:00:00.000Z',
        },
      ],
    };

    expect(hasSemanticManifestDiff(m1, m2)).toBe(true);

    const m3: Manifest = {
      ...m1,
      links: {
        linkedin: 'https://linkedin.com/in/newprofile',
      },
    };

    expect(hasSemanticManifestDiff(m1, m3)).toBe(true);
  });
});

