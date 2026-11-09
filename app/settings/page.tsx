'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  useVault,
  selectOrderedBranches,
  selectTrashVersions,
  selectProfileLinks,
} from '@/store/useVault';
import { getConfig, encodeSetupCode, clearConfig } from '@/lib/config';
import { clearAllCache } from '@/lib/cache';
import { sync } from '@/lib/sync';
import { SyncDot } from '@/src/components/SyncDot';
import { BranchBadge } from '@/components/BranchBadge';
import { AnimatedBottomSheet } from '@/components/AnimatedBottomSheet';
import {
  GitBranchIcon,
  ClockHistoryIcon,
  GitCommitIcon,
  SmartphoneIcon,
  InstallAppIcon,
} from '@/components/SvgIcons';
import { usePwaInstall, InstallInstructionsModal } from '@/components/InstallPwaPrompt';
import { showToast } from '@/components/ToastContainer';
import { Branch, ProfileLink } from '@/types';
import {
  RefreshCw,
  Copy,
  Check,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Archive,
  ArchiveRestore,
  LogOut,
  AlertTriangle,
  Trash2,
  Database,
  Lock,
  KeyRound,
  Linkedin,
  Github,
  Globe,
  Twitter,
  Link as LinkIcon,
  X,
} from 'lucide-react';
import clsx from 'clsx';

export default function SettingsPage() {
  const router = useRouter();
  const {
    manifest,
    syncStatus,
    lastSyncAt,
    addBranch,
    updateBranch,
    reorderBranches,
    archiveBranch,
    updateProfileLinks,
  } = useVault();

  const profileLinks = selectProfileLinks(manifest);
  const [linksLinkedIn, setLinksLinkedIn] = useState(profileLinks.linkedin || '');
  const [linksGitHub, setLinksGitHub] = useState(profileLinks.github || '');
  const [linksPortfolio, setLinksPortfolio] = useState(profileLinks.portfolio || '');
  const [linksTwitter, setLinksTwitter] = useState(profileLinks.twitter || '');
  const [linksCustom, setLinksCustom] = useState<ProfileLink[]>(profileLinks.custom || []);

  useEffect(() => {
    if (manifest?.links) {
      setLinksLinkedIn(manifest.links.linkedin || '');
      setLinksGitHub(manifest.links.github || '');
      setLinksPortfolio(manifest.links.portfolio || '');
      setLinksTwitter(manifest.links.twitter || '');
      setLinksCustom(manifest.links.custom ? [...manifest.links.custom] : []);
    }
  }, [manifest?.links]);

  const handleSaveProfileLinks = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateProfileLinks({
      linkedin: linksLinkedIn.trim(),
      github: linksGitHub.trim(),
      portfolio: linksPortfolio.trim(),
      twitter: linksTwitter.trim(),
      custom: linksCustom.filter((c) => c.label.trim() && c.url.trim()),
    });
    showToast({ type: 'success', message: 'Profile links saved permanently' });
  };

  const [copiedCode, setCopiedCode] = useState(false);

  // Branch editing sheet
  const [isEditingBranch, setIsEditingBranch] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchColor, setBranchColor] = useState('#18181B');

  // Sign out confirmation sheet
  const [isConfirmingSignOut, setIsConfirmingSignOut] = useState(false);

  // PWA installation state
  const { isMounted: isPwaMounted, isStandalone, canPromptNative, promptInstall, isIOS } = usePwaInstall();
  const [showInstallInstructions, setShowInstallInstructions] = useState(false);

  const handleInstallClick = async () => {
    if (canPromptNative) {
      const outcome = await promptInstall();
      if (outcome === 'manual-instructions') {
        setShowInstallInstructions(true);
      }
    } else {
      setShowInstallInstructions(true);
    }
  };

  const branches = selectOrderedBranches(manifest, true);
  const trashItems = selectTrashVersions(manifest);
  const config = getConfig();

  const handleSyncNow = async () => {
    await sync();
    showToast({ type: 'success', message: 'Sync complete' });
  };

  const handleCopySetupCode = async () => {
    if (!config) return;
    const code = encodeSetupCode(config);
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(true);
      showToast({ type: 'success', message: 'Setup code copied to clipboard!' });
      setTimeout(() => setCopiedCode(false), 2500);
    } catch {
      showToast({ type: 'error', message: 'Failed to copy to clipboard' });
    }
  };

  const openAddBranch = () => {
    setEditingBranchId(null);
    setBranchName('');
    setBranchColor('#18181B');
    setIsEditingBranch(true);
  };

  const openEditBranch = (b: Branch) => {
    setEditingBranchId(b.id);
    setBranchName(b.name);
    setBranchColor(b.color);
    setIsEditingBranch(true);
  };

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) return;

    if (editingBranchId) {
      await updateBranch(editingBranchId, {
        name: branchName.trim(),
        color: branchColor,
      });
      showToast({ type: 'success', message: 'Branch updated' });
    } else {
      await addBranch({
        name: branchName.trim(),
        color: branchColor,
      });
      showToast({ type: 'success', message: 'Branch created' });
    }
    setIsEditingBranch(false);
  };

  const handleMoveBranch = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= branches.length) return;

    const newOrder = [...branches];
    const temp = newOrder[index];
    newOrder[index] = newOrder[targetIndex];
    newOrder[targetIndex] = temp;

    await reorderBranches(newOrder.map((b) => b.id));
  };

  const handleClearCache = async () => {
    await clearAllCache();
    showToast({ type: 'success', message: 'Local storage cache cleared' });
  };

  const handleSignOut = async () => {
    clearConfig();
    await clearAllCache();
    useVault.setState({
      manifest: null,
      manifestSha: null,
      outbox: [],
      syncStatus: 'offline',
      lastSyncAt: null,
    });
    showToast({ type: 'info', message: 'Disconnected repository' });
    router.replace('/setup');
  };

  return (
    <div className="max-w-xl mx-auto space-y-6 pb-14">
      {/* Header */}
      <div>
        <h1 className="font-mono font-bold text-lg text-zinc-950">Settings & Sync</h1>
        <p className="text-xs font-mono text-zinc-400 mt-0.5">
          Branch architecture, repository configuration, and device cache
        </p>
      </div>

      {/* Sync Card */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-mono font-bold text-zinc-900 uppercase tracking-wider">
              Sync Engine
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <SyncDot status={syncStatus} showLabel />
              {lastSyncAt && (
                <span className="text-[11px] font-mono text-zinc-400">
                  • {new Date(lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleSyncNow}
            disabled={syncStatus === 'syncing'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-medium rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 active:scale-98 transition-all min-h-[38px]"
          >
            <RefreshCw
              size={13}
              className={clsx(syncStatus === 'syncing' && 'animate-spin')}
            />
            <span>Sync Outbox</span>
          </button>
        </div>

        {config && (
          <div className="pt-3 border-t border-zinc-100">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-500 mb-2">
              <span>Connected Repo</span>
              <span className="font-semibold text-zinc-900">
                {config.owner}/{config.repo}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopySetupCode}
              className="w-full py-2.5 px-3 rounded-xl border border-zinc-200 bg-zinc-50/70 hover:bg-zinc-100/80 active:scale-98 transition-all flex items-center justify-center gap-2 text-xs font-mono font-medium min-h-[42px]"
            >
              {copiedCode ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span>Setup code copied!</span>
                </>
              ) : (
                <>
                  <Copy size={14} className="text-zinc-500" />
                  <span>Copy cross-device setup code</span>
                </>
              )}
            </button>
            <p className="text-[10px] font-mono text-zinc-400 mt-1.5 flex items-center gap-1">
              <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
              <span>Gives full read/write access to your private resume repo.</span>
            </p>
          </div>
        )}
      </div>

      {/* Branches Manager Card */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-subtle space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xs font-mono font-bold text-zinc-900 uppercase tracking-wider">
              Branches Manager ({branches.length})
            </h2>
            <p className="text-[11px] font-mono text-zinc-400 mt-0.5">
              Customize Git-style resume career tracks
            </p>
          </div>
          <button
            type="button"
            onClick={openAddBranch}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800 transition-colors"
          >
            <Plus size={13} />
            <span>New Branch</span>
          </button>
        </div>

        <div className="divide-y divide-zinc-100 border border-zinc-200/70 rounded-xl overflow-hidden">
          {branches.map((b, idx) => (
            <div
              key={b.id}
              className="p-3 bg-white flex items-center justify-between gap-3 text-xs font-mono"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: b.color }}
                />
                <span className="font-semibold text-zinc-900 truncate">{b.name}</span>
                {b.archived && (
                  <span className="text-[9px] uppercase px-1 py-0.5 rounded bg-zinc-100 text-zinc-500">
                    archived
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleMoveBranch(idx, 'up')}
                  disabled={idx === 0}
                  className="p-1 text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                  title="Move up"
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleMoveBranch(idx, 'down')}
                  disabled={idx === branches.length - 1}
                  className="p-1 text-zinc-400 hover:text-zinc-900 disabled:opacity-20"
                  title="Move down"
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => openEditBranch(b)}
                  className="p-1 text-zinc-400 hover:text-zinc-900"
                  title="Edit branch"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => archiveBranch(b.id, !b.archived)}
                  className="p-1 text-zinc-400 hover:text-zinc-900"
                  title={b.archived ? 'Restore' : 'Archive'}
                >
                  {b.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Archive / Trash Navigation Card */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-subtle flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
            <ClockHistoryIcon size={16} />
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-zinc-900 uppercase tracking-wider">
              Archive & Trash ({trashItems.length})
            </h3>
            <p className="text-[11px] font-mono text-zinc-400">
              Soft-deleted resumes kept for 30 days before purge
            </p>
          </div>
        </div>
        <Link
          href="/trash"
          className="px-3.5 py-1.5 rounded-xl border border-zinc-200 text-xs font-mono font-medium hover:bg-zinc-50 transition-colors"
        >
          View Trash
        </Link>
      </div>

      {/* Career Profile Links Card */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
              <LinkIcon size={15} />
            </div>
            <div>
              <h3 className="text-xs font-mono font-bold text-zinc-900 uppercase tracking-wider">
                Career Profile Links
              </h3>
              <p className="text-[11px] font-mono text-zinc-400">
                Permanent URLs stored in vault &amp; available for 1-click copy
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfileLinks} className="space-y-3.5 font-mono text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="flex items-center gap-1.5 text-zinc-700 mb-1 font-medium text-[11px]">
                <Linkedin size={12} className="text-zinc-500" />
                <span>LinkedIn URL</span>
              </label>
              <input
                type="url"
                placeholder="https://linkedin.com/in/username"
                value={linksLinkedIn}
                onChange={(e) => setLinksLinkedIn(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-zinc-700 mb-1 font-medium text-[11px]">
                <Github size={12} className="text-zinc-500" />
                <span>GitHub URL</span>
              </label>
              <input
                type="url"
                placeholder="https://github.com/username"
                value={linksGitHub}
                onChange={(e) => setLinksGitHub(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-zinc-700 mb-1 font-medium text-[11px]">
                <Globe size={12} className="text-zinc-500" />
                <span>Portfolio / Website</span>
              </label>
              <input
                type="url"
                placeholder="https://yourname.com"
                value={linksPortfolio}
                onChange={(e) => setLinksPortfolio(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
              />
            </div>

            <div>
              <label className="flex items-center gap-1.5 text-zinc-700 mb-1 font-medium text-[11px]">
                <Twitter size={12} className="text-zinc-500" />
                <span>Twitter / X</span>
              </label>
              <input
                type="url"
                placeholder="https://x.com/username"
                value={linksTwitter}
                onChange={(e) => setLinksTwitter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
              />
            </div>
          </div>

          {/* Custom Links Section */}
          <div className="pt-2 border-t border-zinc-100 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-600 font-medium text-[11px]">Custom Profile Links</span>
              <button
                type="button"
                onClick={() =>
                  setLinksCustom([
                    ...linksCustom,
                    { id: crypto.randomUUID(), label: '', url: '' },
                  ])
                }
                className="inline-flex items-center gap-1 text-[11px] text-zinc-900 hover:underline"
              >
                <Plus size={11} />
                <span>Add Custom Link</span>
              </button>
            </div>

            {linksCustom.map((item) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Label (e.g. Substack)"
                  value={item.label}
                  onChange={(e) =>
                    setLinksCustom(
                      linksCustom.map((c) =>
                        c.id === item.id ? { ...c, label: e.target.value } : c
                      )
                    )
                  }
                  className="w-1/3 px-2.5 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
                <input
                  type="url"
                  placeholder="https://..."
                  value={item.url}
                  onChange={(e) =>
                    setLinksCustom(
                      linksCustom.map((c) =>
                        c.id === item.id ? { ...c, url: e.target.value } : c
                      )
                    )
                  }
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
                <button
                  type="button"
                  onClick={() =>
                    setLinksCustom(linksCustom.filter((c) => c.id !== item.id))
                  }
                  className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 transition-colors text-xs font-semibold shadow-xs"
            >
              Save Profile Links
            </button>
          </div>
        </form>
      </div>

      {/* Cache & Maintenance */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Database size={16} className="text-zinc-500" />
            <div>
              <h3 className="text-xs font-mono font-bold text-zinc-900 uppercase tracking-wider">
                Local Device Cache
              </h3>
              <p className="text-[11px] font-mono text-zinc-400">
                IndexedDB offline PDF and thumbnail storage
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearCache}
            className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-mono text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
          >
            Purge Cache
          </button>
        </div>
      </div>

      {/* Progressive Web App (PWA) Card */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SmartphoneIcon size={16} className="text-zinc-600" />
            <div>
              <h3 className="text-xs font-mono font-bold text-zinc-900 uppercase tracking-wider">
                Progressive Web App
              </h3>
              <p className="text-[11px] font-mono text-zinc-400">
                {isStandalone
                  ? 'Active in standalone app mode'
                  : 'Install storr. to your device home screen'}
              </p>
            </div>
          </div>
          {isStandalone ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-mono font-semibold">
              <Check size={12} />
              <span>Installed</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={handleInstallClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 transition-colors text-xs font-mono font-medium shadow-xs"
            >
              <InstallAppIcon size={13} />
              <span>Install App</span>
            </button>
          )}
        </div>
      </div>

      {/* Credential Security, Persistence & Disconnect */}
      <div className="p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-subtle space-y-3.5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800">
            <Lock size={15} />
          </div>
          <div>
            <h3 className="text-xs font-mono font-bold text-zinc-900 uppercase tracking-wider">
              Token Security & Persistence
            </h3>
            <p className="text-[11px] font-mono text-zinc-400">
              Dual-persisted locally in localStorage + IndexedDB
            </p>
          </div>
        </div>

        <p className="text-xs font-mono text-zinc-600 leading-relaxed">
          Your GitHub Personal Access Token is stored exclusively on this device. <span className="font-bold text-zinc-950">storr. will never forget your token</span> across browser restarts, low-disk storage cleanups, or iOS Safari eviction cycles.
        </p>

        <div className="bg-zinc-50 rounded-xl p-3 border border-zinc-200/80 text-[11px] font-mono text-zinc-600 space-y-1">
          <span className="font-bold text-zinc-900 block">How to Erase Credentials:</span>
          <p>
            To revoke access and remove your token and cached resumes from this device, click the button below. Your private repository on GitHub remains completely untouched.
          </p>
        </div>

        <div className="pt-1">
          <button
            type="button"
            onClick={() => setIsConfirmingSignOut(true)}
            className="w-full py-3 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950 font-mono text-xs font-medium transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={14} />
            <span>Disconnect Private Repository</span>
          </button>
        </div>
      </div>

      {/* Edit Branch Bottom Sheet */}
      <AnimatedBottomSheet
        isOpen={isEditingBranch}
        onClose={() => setIsEditingBranch(false)}
        title={editingBranchId ? 'Edit Branch' : 'Create Branch'}
      >
        <form onSubmit={handleSaveBranch} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
              Branch Name
            </label>
            <input
              type="text"
              required
              maxLength={36}
              placeholder="e.g. main, data-science, fintech"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-zinc-950"
            />
          </div>

          <div>
            <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
              Accent Color
            </label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={branchColor}
                onChange={(e) => setBranchColor(e.target.value)}
                className="w-8 h-8 rounded border border-zinc-200 cursor-pointer p-0.5 bg-white"
              />
              <span className="text-xs font-mono text-zinc-500">{branchColor}</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsEditingBranch(false)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 text-xs font-mono font-medium hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800"
            >
              Save Branch
            </button>
          </div>
        </form>
      </AnimatedBottomSheet>

      {/* Confirm Sign Out Sheet */}
      <AnimatedBottomSheet
        isOpen={isConfirmingSignOut}
        onClose={() => setIsConfirmingSignOut(false)}
        title="Disconnect Repository?"
      >
        <div className="space-y-4 pt-1 text-xs font-mono">
          <p className="text-zinc-600 leading-relaxed">
            This clears your fine-grained GitHub token and local cached resumes from this device. Your data in your private GitHub repository will remain untouched.
          </p>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsConfirmingSignOut(false)}
              className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 text-xs font-mono font-medium hover:bg-zinc-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSignOut}
              className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-950 text-white text-xs font-mono font-medium hover:bg-zinc-800"
            >
              Yes, Disconnect
            </button>
          </div>
        </div>
      </AnimatedBottomSheet>

      {/* PWA Install Instructions Sheet */}
      <InstallInstructionsModal
        isOpen={showInstallInstructions}
        onClose={() => setShowInstallInstructions(false)}
        isIOS={isIOS}
      />
    </div>
  );
}

