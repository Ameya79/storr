'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { validateRepo } from '@/lib/github';
import { setConfig, getConfig, decodeSetupCode, encodeSetupCode } from '@/lib/config';
import { sync } from '@/lib/sync';
import { showToast } from '@/components/ToastContainer';
import { GitBranchIcon } from '@/components/SvgIcons';
import {
  ArrowRight,
  ShieldAlert,
  KeyRound,
  Database,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Briefcase,
  GitFork,
  Link as LinkIcon,
  Copy,
  Check,
  Smartphone,
  HardDrive,
  Layers,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReauth = searchParams.get('reauth') === '1';

  const [mode, setMode] = useState<'form' | 'code'>('form');
  const [mobileView, setMobileView] = useState<'connect' | 'preview'>('connect');
  const [repoInput, setRepoInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [setupCodeInput, setSetupCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  // Live cluster stats
  const [stats, setStats] = useState<{ resumesStored: number; vaultsActive: number }>({
    resumesStored: 146,
    vaultsActive: 42,
  });

  // Interactive preview tab state
  const [previewTab, setPreviewTab] = useState<'tree' | 'tracker' | 'links' | 'code'>('tree');
  const [activeTreeNode, setActiveTreeNode] = useState<string>('c3');
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // Cross-device encoder mini-tool state
  const [toolOwner, setToolOwner] = useState('username');
  const [toolRepo, setToolRepo] = useState('my-resumes');
  const [toolToken, setToolToken] = useState('ghp_sampleToken123');
  const [encodedResult, setEncodedResult] = useState('');

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => r.json())
      .then((data) => {
        if (data && data.resumesStored) {
          setStats(data);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const existing = getConfig();
    if (existing) {
      if (isReauth) {
        setRepoInput(`${existing.owner}/${existing.repo}`);
        setErrorMsg('Your GitHub token expired or was revoked. Please enter a valid token.');
      } else {
        router.replace('/');
      }
    }
  }, [isReauth, router]);

  useEffect(() => {
    if (toolOwner && toolRepo && toolToken) {
      try {
        const code = encodeSetupCode({
          owner: toolOwner.trim(),
          repo: toolRepo.trim(),
          token: toolToken.trim(),
        });
        setEncodedResult(code);
      } catch {
        setEncodedResult('');
      }
    }
  }, [toolOwner, toolRepo, toolToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsLoading(true);

    try {
      let owner = '';
      let repo = '';
      let token = '';

      if (mode === 'code') {
        const decoded = decodeSetupCode(setupCodeInput);
        if (!decoded) {
          setErrorMsg('Invalid setup code. Please check and try again.');
          setIsLoading(false);
          return;
        }
        owner = decoded.owner;
        repo = decoded.repo;
        token = decoded.token;
      } else {
        const parts = repoInput.trim().split('/');
        if (parts.length !== 2 || !parts[0] || !parts[1]) {
          setErrorMsg('Please enter repository as "username/repository-name"');
          setIsLoading(false);
          return;
        }
        owner = parts[0].trim();
        repo = parts[1].trim();
        token = tokenInput.trim();

        if (!token) {
          setErrorMsg('Personal Access Token is required.');
          setIsLoading(false);
          return;
        }
      }

      const cfg = { owner, repo, token };
      const validation = await validateRepo(cfg);

      if (!validation.ok) {
        setErrorMsg(validation.error || 'Repository validation failed.');
        setIsLoading(false);
        return;
      }

      // Valid: save config and trigger initial sync
      setConfig(cfg);
      fetch('/api/stats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'vault_connected' }),
      }).catch(() => {});

      showToast({
        type: 'success',
        message: 'Connected repository. Initializing branch vault…',
      });

      await sync();
      router.replace('/');
    } catch (err: unknown) {
      setErrorMsg((err as Error)?.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedLink(id);
    setTimeout(() => setCopiedLink(null), 2000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto pt-2 pb-16 px-3 sm:px-6">
      {/* Top Brand Banner */}
      <div className="flex flex-col items-center text-center mb-8 pt-3 sm:pt-6">
        <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center mb-3 shadow-subtle border border-zinc-800">
          <GitBranchIcon size={24} />
        </div>
        <div className="flex items-center gap-2 mb-2">
          <h1 className="font-mono font-bold text-2xl sm:text-3xl text-zinc-950 tracking-tight">
            storr.
          </h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200">
            v1.0.0
          </span>
        </div>
        <p className="font-sans text-xs sm:text-sm text-zinc-600 max-w-lg mx-auto leading-relaxed px-2">
          Git-powered career resume version control, branch-driven lineage, and application tracking with zero database hosting fees.
        </p>

        {/* Live Metrics Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-50 border border-zinc-200/90 text-xs font-sans text-zinc-600 mt-3.5 shadow-2xs">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />
          <span>
            <strong className="text-zinc-950 font-mono font-semibold">
              {stats.resumesStored.toLocaleString()}
            </strong>{' '}
            resumes storred
          </span>
          <span className="text-zinc-300">•</span>
          <span>
            <strong className="text-zinc-950 font-mono font-semibold">
              {stats.vaultsActive.toLocaleString()}
            </strong>{' '}
            active vaults
          </span>
        </div>
      </div>

      {/* Mobile-Only Segmented View Switcher (Prevents Cluttered Vertical Stacking) */}
      {!isReauth && (
        <div className="lg:hidden flex bg-zinc-100 p-1 rounded-xl mb-6 border border-zinc-200/90 shadow-2xs">
          <button
            type="button"
            onClick={() => setMobileView('connect')}
            className={clsx(
              'flex-1 py-2 text-xs font-sans rounded-lg transition-all min-h-[40px]',
              mobileView === 'connect'
                ? 'bg-white text-zinc-950 shadow-xs font-semibold'
                : 'text-zinc-500 hover:text-zinc-900 font-medium'
            )}
          >
            Connect Private Vault
          </button>
          <button
            type="button"
            onClick={() => setMobileView('preview')}
            className={clsx(
              'flex-1 py-2 text-xs font-sans rounded-lg transition-all min-h-[40px]',
              mobileView === 'preview'
                ? 'bg-white text-zinc-950 shadow-xs font-semibold'
                : 'text-zinc-500 hover:text-zinc-900 font-medium'
            )}
          >
            Live Demo & Preview
          </button>
        </div>
      )}

      {/* Main Workspace: Side-by-Side on Desktop, Responsive View on Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start mb-12">
        {/* Left Column: Repository Connection Card */}
        <div
          className={clsx(
            'lg:col-span-6 bg-white border border-zinc-200/90 rounded-2xl p-4 sm:p-6 shadow-xs',
            mobileView === 'preview' && 'hidden lg:block'
          )}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-sm font-sans font-bold text-zinc-950">
                {isReauth ? 'Re-Authenticate Vault' : 'Connect Private Vault'}
              </h2>
              <p className="text-xs font-sans text-zinc-500 mt-0.5">
                {isReauth
                  ? 'Update expired or revoked credentials'
                  : 'Link a private GitHub repository as your encrypted database'}
              </p>
            </div>
            <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-800 flex-shrink-0">
              <HardDrive size={15} />
            </div>
          </div>

          {/* Mode Switcher */}
          {!isReauth && (
            <div className="flex bg-zinc-100 rounded-xl p-1 border border-zinc-200 mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('form');
                  setErrorMsg(null);
                }}
                className={clsx(
                  'flex-1 py-2 text-xs font-sans font-medium rounded-lg transition-all min-h-[40px]',
                  mode === 'form'
                    ? 'bg-white text-zinc-950 shadow-xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900'
                )}
              >
                Repo & Token
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('code');
                  setErrorMsg(null);
                }}
                className={clsx(
                  'flex-1 py-2 text-xs font-sans font-medium rounded-lg transition-all min-h-[40px]',
                  mode === 'code'
                    ? 'bg-white text-zinc-950 shadow-xs font-semibold'
                    : 'text-zinc-500 hover:text-zinc-900'
                )}
              >
                Paste Setup Code
              </button>
            </div>
          )}

          {/* Error Alert */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-zinc-50 border border-zinc-300 text-zinc-900 text-xs font-sans flex gap-2.5 items-start">
              <ShieldAlert size={15} className="text-zinc-800 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Connection Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'form' ? (
              <>
                <div>
                  <label className="block text-xs font-sans font-medium text-zinc-700 mb-1.5">
                    Private GitHub Repository
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="username/resume-vault-data"
                    value={repoInput}
                    onChange={(e) => setRepoInput(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 min-h-[44px]"
                  />
                  <p className="text-[11px] font-sans text-zinc-400 mt-1">
                    E.g. octocat/my-resumes (target private storage repository)
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-sans font-medium text-zinc-700">
                      Fine-Grained Personal Access Token
                    </label>
                    <a
                      href="https://github.com/settings/tokens?type=beta"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-sans text-zinc-500 hover:text-zinc-900 underline inline-flex items-center gap-0.5"
                    >
                      Generate <ExternalLink size={9} />
                    </a>
                  </div>
                  <input
                    type="password"
                    required
                    placeholder="github_pat_..."
                    value={tokenInput}
                    onChange={(e) => setTokenInput(e.target.value)}
                    disabled={isLoading}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 min-h-[44px]"
                  />
                  <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-sans text-zinc-500">
                    <ShieldCheck size={13} className="text-emerald-600 flex-shrink-0" />
                    <span>Scoped to: Contents (Read and write) on single repo</span>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-sans font-medium text-zinc-700 mb-1.5">
                  Cross-Device Setup Code
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Paste the base64 setup code copied from your other browser or device..."
                  value={setupCodeInput}
                  onChange={(e) => setSetupCodeInput(e.target.value)}
                  disabled={isLoading}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 resize-none"
                />
                <p className="text-[11px] font-sans text-zinc-400 mt-1">
                  Transfers repository and token securely across browsers without re-typing.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl bg-zinc-950 text-white font-sans font-semibold text-xs shadow-xs hover:bg-zinc-800 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[46px] mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isReauth ? 'Update Token' : 'Connect & Initialize Vault'}</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          {/* Quick Security Guarantee (Formatted cleanly so it never wraps awkwardly on narrow screens) */}
          <div className="mt-5 pt-3.5 border-t border-zinc-100 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] font-sans text-zinc-500 text-center">
            <span className="flex items-center gap-1.5">
              <Database size={11} className="text-zinc-600 flex-shrink-0" />
              <span>Dual-Storage (IndexedDB + LocalStorage)</span>
            </span>
            <span className="text-zinc-300 hidden sm:inline">•</span>
            <span>Zero Cloud Relays</span>
          </div>
        </div>

        {/* Right Column: Interactive App Details & Functional Demo */}
        <div
          className={clsx(
            'lg:col-span-6 bg-zinc-50 border border-zinc-200/90 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col justify-between',
            mobileView === 'connect' && 'hidden lg:flex'
          )}
        >
          <div>
            <div className="flex items-center justify-between mb-3.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-sans font-bold text-zinc-950 uppercase tracking-wider">
                  Interactive Preview
                </span>
                <span className="px-1.5 py-0.5 rounded bg-zinc-200 text-[10px] font-mono text-zinc-700 font-semibold">
                  Live
                </span>
              </div>
              <span className="text-[11px] font-sans text-zinc-500 hidden sm:inline">Click tabs to inspect</span>
            </div>

            {/* Preview Tabs */}
            <div className="grid grid-cols-4 gap-1 bg-zinc-200/70 p-1 rounded-xl mb-4 text-xs font-sans">
              <button
                type="button"
                onClick={() => setPreviewTab('tree')}
                className={clsx(
                  'py-1.5 rounded-lg text-center transition-all min-h-[34px] font-medium text-[11px]',
                  previewTab === 'tree'
                    ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                Tree View
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('tracker')}
                className={clsx(
                  'py-1.5 rounded-lg text-center transition-all min-h-[34px] font-medium text-[11px]',
                  previewTab === 'tracker'
                    ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                Tracker
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('links')}
                className={clsx(
                  'py-1.5 rounded-lg text-center transition-all min-h-[34px] font-medium text-[11px]',
                  previewTab === 'links'
                    ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                Links Dock
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab('code')}
                className={clsx(
                  'py-1.5 rounded-lg text-center transition-all min-h-[34px] font-medium text-[11px]',
                  previewTab === 'code'
                    ? 'bg-white text-zinc-950 shadow-2xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900'
                )}
              >
                Code Tool
              </button>
            </div>

            {/* Tab 1: Visual Git Tree Lineage (Optimized to never crush titles or pills on mobile) */}
            {previewTab === 'tree' && (
              <div className="bg-white rounded-xl border border-zinc-200 p-3 sm:p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-sans text-zinc-500 pb-2 border-b border-zinc-100">
                  <span className="font-mono">Branch: swe-infrastructure</span>
                  <span>Commit Lineage</span>
                </div>

                {/* Tree Nodes */}
                <div className="space-y-2">
                  <div
                    onClick={() => setActiveTreeNode('c3')}
                    className={clsx(
                      'p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1.5',
                      activeTreeNode === 'c3'
                        ? 'border-zinc-950 bg-white shadow-2xs'
                        : 'border-zinc-200/80 bg-zinc-50/60 hover:border-zinc-300'
                    )}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-1.5" />
                      <div className="min-w-0">
                        <div className="font-sans font-semibold text-xs text-zinc-900 truncate">
                          v3.2 - Kubernetes & Go refactor
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                          commit 8f3d1e • 2 days ago
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center pl-4 sm:pl-0 flex-shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-mono font-medium">
                        Applied: Stripe
                      </span>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveTreeNode('c2')}
                    className={clsx(
                      'p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1.5',
                      activeTreeNode === 'c2'
                        ? 'border-zinc-950 bg-white shadow-2xs'
                        : 'border-zinc-200/80 bg-zinc-50/60 hover:border-zinc-300'
                    )}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-zinc-900 flex-shrink-0 mt-1.5" />
                      <div className="min-w-0">
                        <div className="font-sans font-semibold text-xs text-zinc-900 truncate">
                          v3.1 - Distributed caching bullet points
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                          commit b4a29c • 5 days ago
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center pl-4 sm:pl-0 flex-shrink-0">
                      <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200 text-[10px] font-mono font-medium">
                        Applied: Datadog
                      </span>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveTreeNode('c1')}
                    className={clsx(
                      'p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-1.5',
                      activeTreeNode === 'c1'
                        ? 'border-zinc-950 bg-white shadow-2xs'
                        : 'border-zinc-200/80 bg-zinc-50/60 hover:border-zinc-300'
                    )}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full bg-zinc-400 flex-shrink-0 mt-1.5" />
                      <div className="min-w-0">
                        <div className="font-sans font-semibold text-xs text-zinc-900 truncate">
                          v3.0 - Baseline backend fork
                        </div>
                        <div className="text-[10px] font-mono text-zinc-400 mt-0.5">
                          commit a127fe • 12 days ago
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center pl-4 sm:pl-0 flex-shrink-0">
                      <span className="text-[10px] font-mono text-zinc-400">Root commit</span>
                    </div>
                  </div>
                </div>

                <div className="pt-1 text-[11px] font-sans text-zinc-500 flex items-center gap-1.5">
                  <Sparkles size={11} className="text-zinc-700 flex-shrink-0" />
                  <span>Tree nodes display latest applied company tags right in the lineage.</span>
                </div>
              </div>
            )}

            {/* Tab 2: Application Tracker Preview */}
            {previewTab === 'tracker' && (
              <div className="bg-white rounded-xl border border-zinc-200 p-3 sm:p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-sans text-zinc-500 pb-2 border-b border-zinc-100">
                  <span>Linked Job Applications</span>
                  <span className="font-mono">4 Active</span>
                </div>

                <div className="p-2.5 rounded-xl border border-zinc-200 flex items-center justify-between bg-zinc-50/50">
                  <div className="min-w-0 pr-2">
                    <div className="font-sans font-bold text-xs text-zinc-900 truncate">
                      Staff Platform Engineer
                    </div>
                    <div className="text-[10px] font-sans text-zinc-500 truncate">
                      Stripe • Resume: <span className="font-mono">v3.2</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-sans font-semibold flex-shrink-0">
                    Offer
                  </span>
                </div>

                <div className="p-2.5 rounded-xl border border-zinc-200 flex items-center justify-between bg-zinc-50/50">
                  <div className="min-w-0 pr-2">
                    <div className="font-sans font-bold text-xs text-zinc-900 truncate">
                      Senior Distributed Systems Eng
                    </div>
                    <div className="text-[10px] font-sans text-zinc-500 truncate">
                      Datadog • Resume: <span className="font-mono">v3.1</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-900 border border-purple-300 text-[10px] font-sans font-semibold flex-shrink-0">
                    Interview
                  </span>
                </div>

                <div className="p-2.5 rounded-xl border border-zinc-200 flex items-center justify-between bg-zinc-50/50">
                  <div className="min-w-0 pr-2">
                    <div className="font-sans font-bold text-xs text-zinc-900 truncate">
                      Founding Core Engineer
                    </div>
                    <div className="text-[10px] font-sans text-zinc-500 truncate">
                      Anthropic • Resume: <span className="font-mono">v2.8</span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 border border-blue-300 text-[10px] font-sans font-semibold flex-shrink-0">
                    Screen
                  </span>
                </div>
              </div>
            )}

            {/* Tab 3: Permanent Links Dock Preview */}
            {previewTab === 'links' && (
              <div className="bg-white rounded-xl border border-zinc-200 p-3 sm:p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between text-[11px] font-sans text-zinc-500 pb-2 border-b border-zinc-100">
                  <span>Vault Quick-Links Dock</span>
                  <span>Permanent Settlement</span>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 border border-zinc-200">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <LinkIcon size={12} className="text-zinc-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-sans font-semibold text-xs text-zinc-900 truncate">LinkedIn Profile</div>
                        <div className="text-[10px] font-mono text-zinc-400 truncate">linkedin.com/in/octocat</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('https://linkedin.com/in/octocat', 'p1')}
                      className="px-2 py-1 rounded-lg bg-white border border-zinc-200 text-[10px] font-sans font-medium flex items-center gap-1 text-zinc-700 hover:text-zinc-950 flex-shrink-0"
                    >
                      {copiedLink === 'p1' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      <span>{copiedLink === 'p1' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 border border-zinc-200">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <LinkIcon size={12} className="text-zinc-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-sans font-semibold text-xs text-zinc-900 truncate">GitHub Profile</div>
                        <div className="text-[10px] font-mono text-zinc-400 truncate">github.com/octocat</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('https://github.com/octocat', 'p2')}
                      className="px-2 py-1 rounded-lg bg-white border border-zinc-200 text-[10px] font-sans font-medium flex items-center gap-1 text-zinc-700 hover:text-zinc-950 flex-shrink-0"
                    >
                      {copiedLink === 'p2' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      <span>{copiedLink === 'p2' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 border border-zinc-200">
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <LinkIcon size={12} className="text-zinc-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="font-sans font-semibold text-xs text-zinc-900 truncate">Engineering Portfolio</div>
                        <div className="text-[10px] font-mono text-zinc-400 truncate">octocat.dev</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard('https://octocat.dev', 'p3')}
                      className="px-2 py-1 rounded-lg bg-white border border-zinc-200 text-[10px] font-sans font-medium flex items-center gap-1 text-zinc-700 hover:text-zinc-950 flex-shrink-0"
                    >
                      {copiedLink === 'p3' ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      <span>{copiedLink === 'p3' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                </div>

                <p className="text-[11px] font-sans text-zinc-500 pt-1">
                  Stored in local vault manifest until you decide to remove. Instant copy when filling applications.
                </p>
              </div>
            )}

            {/* Tab 4: Setup Code Generator Utility */}
            {previewTab === 'code' && (
              <div className="bg-white rounded-xl border border-zinc-200 p-3 sm:p-4 space-y-2.5 text-xs font-sans">
                <div className="flex items-center justify-between text-[11px] text-zinc-500 pb-2 border-b border-zinc-100">
                  <span>Cross-Device Code Generator</span>
                  <span className="font-mono">URL-Safe Base64</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Owner</label>
                    <input
                      type="text"
                      value={toolOwner}
                      onChange={(e) => setToolOwner(e.target.value)}
                      className="w-full px-2 py-1 border border-zinc-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-zinc-500 block mb-0.5">Repo</label>
                    <input
                      type="text"
                      value={toolRepo}
                      onChange={(e) => setToolRepo(e.target.value)}
                      className="w-full px-2 py-1 border border-zinc-200 rounded-lg text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-zinc-500 block mb-0.5">Token Preview</label>
                  <input
                    type="password"
                    value={toolToken}
                    onChange={(e) => setToolToken(e.target.value)}
                    className="w-full px-2 py-1 border border-zinc-200 rounded-lg text-xs font-mono"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-zinc-500 font-semibold">Generated Setup Code</span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(encodedResult, 'code-tool')}
                      className="text-[10px] text-zinc-700 hover:text-zinc-950 underline inline-flex items-center gap-1 font-sans"
                    >
                      {copiedLink === 'code-tool' ? <Check size={10} className="text-emerald-600" /> : <Copy size={10} />}
                      <span>{copiedLink === 'code-tool' ? 'Copied' : 'Copy Code'}</span>
                    </button>
                  </div>
                  <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200 break-all text-[11px] text-zinc-800 font-mono">
                    {encodedResult || 'Generating…'}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-zinc-200/80 flex items-center justify-between text-[11px] font-sans text-zinc-500">
            <span>Client-side encryption</span>
            <span className="font-semibold text-zinc-900">100% Free & Open Source</span>
          </div>
        </div>
      </div>

      {/* 6 Core Architectural Highlights (High-density, airy, perfectly spaced for mobile & desktop) */}
      <div className="mb-12">
        <div className="text-center mb-6">
          <h2 className="text-base sm:text-lg font-sans font-bold text-zinc-950">
            Engineered for High-Agency Developers & Engineers
          </h2>
          <p className="text-xs font-sans text-zinc-500 mt-1 max-w-md mx-auto">
            Why professional engineers switch from Google Docs and generic ATS platforms to git-versioned resumes.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center mb-2.5">
              <GitFork size={14} />
            </div>
            <h3 className="font-sans font-bold text-xs text-zinc-950 mb-1">Branch-Driven Versioning</h3>
            <p className="font-sans text-[11px] text-zinc-600 leading-relaxed">
              Create independent branches (backend, tech lead, ML platform) to tailor bullet points for specific job profiles without breaking master lineage.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center mb-2.5">
              <Briefcase size={14} />
            </div>
            <h3 className="font-sans font-bold text-xs text-zinc-950 mb-1">Version-Linked Job Tracker</h3>
            <p className="font-sans text-[11px] text-zinc-600 leading-relaxed">
              Tie each application to the exact commit SHA and PDF version used. Know precisely which wording produced interviews, offers, and screens.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center mb-2.5">
              <Layers size={14} />
            </div>
            <h3 className="font-sans font-bold text-xs text-zinc-950 mb-1">Visual Git Commit Lineage</h3>
            <p className="font-sans text-[11px] text-zinc-600 leading-relaxed">
              Browse your career progression with graphic commit graphs, interactive diffs, and latest applied company pills directly on each node.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center mb-2.5">
              <LinkIcon size={14} />
            </div>
            <h3 className="font-sans font-bold text-xs text-zinc-950 mb-1">Permanent Profile Link Dock</h3>
            <p className="font-sans text-[11px] text-zinc-600 leading-relaxed">
              Settle your LinkedIn, GitHub, Substack, and Portfolio URLs permanently in your private vault with one-click copy during application submission.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center mb-2.5">
              <HardDrive size={14} />
            </div>
            <h3 className="font-sans font-bold text-xs text-zinc-950 mb-1">Zero Database, Zero Cloud Fees</h3>
            <p className="font-sans text-[11px] text-zinc-600 leading-relaxed">
              Your private GitHub repository is your database. No third-party servers, no telemetry spying, no subscription locks. Truly sovereign personal data.
            </p>
          </div>

          <div className="p-4 sm:p-5 rounded-2xl bg-white border border-zinc-200/90 shadow-2xs">
            <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center mb-2.5">
              <Smartphone size={14} />
            </div>
            <h3 className="font-sans font-bold text-xs text-zinc-950 mb-1">Offline-First PWA & Dual Storage</h3>
            <p className="font-sans text-[11px] text-zinc-600 leading-relaxed">
              Encrypted locally across IndexedDB and localStorage. Seamlessly view, search, and download your resumes offline, anywhere on mobile or desktop.
            </p>
          </div>
        </div>
      </div>

      {/* Step-by-Step Repository & Token Guide */}
      <div className="border border-zinc-200/90 rounded-2xl bg-white overflow-hidden shadow-xs mb-10">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50/70 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800 flex-shrink-0">
              <KeyRound size={13} />
            </div>
            <div>
              <span className="font-sans font-bold text-xs text-zinc-950 block">
                How to Connect to GitHub (60-Second Setup Guide)
              </span>
              <span className="text-[11px] font-sans text-zinc-500">
                Private repo creation, fine-grained PAT scopes, and zero-leak security
              </span>
            </div>
          </div>
          {showGuide ? (
            <ChevronUp size={15} className="text-zinc-500 flex-shrink-0" />
          ) : (
            <ChevronDown size={15} className="text-zinc-500 flex-shrink-0" />
          )}
        </button>

        {showGuide && (
          <div className="px-4 pb-5 pt-1 space-y-4 text-xs font-sans border-t border-zinc-100">
            {/* Step 1 */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-2 text-zinc-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] font-mono flex items-center justify-center flex-shrink-0">
                  1
                </span>
                <span>Create a Private Repository</span>
              </div>
              <p className="text-zinc-600 pl-7 leading-relaxed">
                Go to{' '}
                <a
                  href="https://github.com/new"
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-950 underline underline-offset-2 inline-flex items-center gap-0.5"
                >
                  github.com/new <ExternalLink size={10} />
                </a>{' '}
                and name your repository (e.g.{' '}
                <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800 font-mono">my-resumes</code>).
              </p>
              <div className="ml-0 sm:ml-7 mt-2 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-700">
                <span className="font-bold text-zinc-950">Important:</span> Choose{' '}
                <span className="font-bold text-zinc-950">Private</span> so your personal resumes, contact details, and career notes are never publicly visible on the internet.
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] font-mono flex items-center justify-center flex-shrink-0">
                  2
                </span>
                <span>Generate a Fine-Grained Personal Access Token</span>
              </div>
              <p className="text-zinc-600 pl-7 leading-relaxed">
                In GitHub, go to{' '}
                <a
                  href="https://github.com/settings/tokens?type=beta"
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-950 underline underline-offset-2 inline-flex items-center gap-0.5"
                >
                  Settings &gt; Developer Settings &gt; Personal access tokens &gt; Fine-grained tokens <ExternalLink size={10} />
                </a>{' '}
                and click{' '}
                <span className="font-medium text-zinc-800">&quot;Generate new token&quot;</span>.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] font-mono flex items-center justify-center flex-shrink-0">
                  3
                </span>
                <span>Set Strict Token Scopes</span>
              </div>
              <div className="ml-7 space-y-2 text-zinc-600">
                <p className="leading-relaxed">
                  Configure these two specific options for maximum account security:
                </p>
                <ul className="space-y-1.5 list-disc pl-4 text-[11px]">
                  <li>
                    <span className="font-bold text-zinc-900">Repository access:</span> Select{' '}
                    <span className="font-semibold text-zinc-950">&quot;Only select repositories&quot;</span>{' '}
                    and choose your private resume repository. This guarantees storr. cannot touch any other repo in your account.
                  </li>
                  <li>
                    <span className="font-bold text-zinc-900">Repository permissions:</span> Find{' '}
                    <span className="font-semibold text-zinc-950">Contents</span> and select{' '}
                    <span className="font-semibold text-zinc-950">&quot;Read and write&quot;</span>. No other permissions are needed.
                  </li>
                </ul>
              </div>
            </div>

            {/* Step 4 */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 text-zinc-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] font-mono flex items-center justify-center flex-shrink-0">
                  4
                </span>
                <span>Permanent Local Storage Guarantee</span>
              </div>
              <p className="text-zinc-600 pl-7 leading-relaxed text-[11px]">
                Once entered, your token is dual-persisted locally in your browser&apos;s sandboxed{' '}
                <span className="font-medium text-zinc-900">localStorage</span> and{' '}
                <span className="font-medium text-zinc-900">IndexedDB</span>. It will{' '}
                <span className="font-bold text-zinc-950">never be forgotten</span> across sessions or browser restarts unless you manually click{' '}
                <span className="font-medium text-zinc-900">&quot;Disconnect Private Repository&quot;</span> in Settings.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Open Source Footer */}
      <div className="text-center border-t border-zinc-200 pt-6 text-[11px] font-sans text-zinc-500 space-y-1.5">
        <p>
          <span className="font-mono font-bold text-zinc-800">storr.</span> — Open-Source Career Resume Version Control • Private GitHub API • Zero Cloud Database Cost
        </p>
        <p className="text-zinc-400">
          Crafted with Next.js 14, Tailwind CSS, TypeScript, and IndexedDB. MIT Licensed.
        </p>
      </div>
    </div>
  );
}

export default function SetupPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-8 text-center text-xs font-mono text-zinc-400">
          Loading repository setup…
        </div>
      }
    >
      <SetupContent />
    </React.Suspense>
  );
}
