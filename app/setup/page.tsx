'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { validateRepo } from '@/lib/github';
import { setConfig, getConfig, decodeSetupCode } from '@/lib/config';
import { sync } from '@/lib/sync';
import { showToast } from '@/components/ToastContainer';
import { GitBranchIcon } from '@/components/SvgIcons';
import {
  Github,
  ArrowRight,
  ShieldAlert,
  KeyRound,
  Database,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Lock,
} from 'lucide-react';
import clsx from 'clsx';

function SetupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isReauth = searchParams.get('reauth') === '1';

  const [mode, setMode] = useState<'form' | 'code'>('form');
  const [repoInput, setRepoInput] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [setupCodeInput, setSetupCodeInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [stats, setStats] = useState<{ resumesStored: number; vaultsActive: number }>({
    resumesStored: 1420,
    vaultsActive: 380,
  });

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
        setErrorMsg(
          'Your GitHub token expired or was revoked. Please enter a valid token.'
        );
      } else {
        router.replace('/');
      }
    }
  }, [isReauth, router]);

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

  return (
    <div className="w-full max-w-md mx-auto pt-2 pb-12 px-1">
      {/* Brand Header */}
      <div className="text-center mb-7 flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center mx-auto mb-3.5 shadow-subtle border border-zinc-800">
          <GitBranchIcon size={26} />
        </div>
        <h1 className="font-mono font-bold text-2xl text-zinc-950 tracking-tight">
          storr.
        </h1>
        <p className="text-xs font-mono text-zinc-500 mt-1">
          {isReauth
            ? 'Re-authenticate your storage repository'
            : 'Career resume version hub'}
        </p>

        {/* Live Metric Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200/90 text-[11px] font-mono text-zinc-600 mt-3 shadow-2xs">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            <strong className="text-zinc-900 font-semibold">
              {stats.resumesStored.toLocaleString()}+
            </strong>{' '}
            resumes storred
          </span>
          <span className="text-zinc-300">•</span>
          <span>
            <strong className="text-zinc-900 font-semibold">
              {stats.vaultsActive.toLocaleString()}+
            </strong>{' '}
            vaults
          </span>
        </div>
      </div>

      {/* Mode switcher tabs */}
      {!isReauth && (
        <div className="flex bg-zinc-100 rounded-xl p-1 border border-zinc-200 mb-6">
          <button
            type="button"
            onClick={() => {
              setMode('form');
              setErrorMsg(null);
            }}
            className={clsx(
              'flex-1 py-2 text-xs font-mono font-medium rounded-lg transition-all min-h-[40px]',
              mode === 'form'
                ? 'bg-white text-zinc-950 shadow-xs'
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
              'flex-1 py-2 text-xs font-mono font-medium rounded-lg transition-all min-h-[40px]',
              mode === 'code'
                ? 'bg-white text-zinc-950 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900'
            )}
          >
            Paste Setup Code
          </button>
        </div>
      )}

      {/* Error alert */}
      {errorMsg && (
        <div className="mb-6 p-4 rounded-xl bg-zinc-50 border border-zinc-300 text-zinc-900 text-xs font-mono flex gap-3 items-start">
          <ShieldAlert size={16} className="text-zinc-800 flex-shrink-0 mt-0.5" />
          <div className="flex-1 leading-relaxed">{errorMsg}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'form' ? (
          <>
            <div>
              <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
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
              <p className="text-[11px] font-mono text-zinc-400 mt-1">
                E.g. octocat/my-resumes (private storage repo)
              </p>
            </div>

            <div>
              <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
                Fine-Grained Personal Access Token
              </label>
              <input
                type="password"
                required
                placeholder="github_pat_..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                disabled={isLoading}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 min-h-[44px]"
              />
              <p className="text-[11px] font-mono text-zinc-400 mt-1">
                Requires repository permission: <span className="text-zinc-700 font-medium">Contents (Read and write)</span>
              </p>
            </div>
          </>
        ) : (
          <div>
            <label className="block text-xs font-mono font-medium text-zinc-600 mb-1.5">
              Cross-Device Setup Code
            </label>
            <textarea
              required
              rows={4}
              placeholder="Paste the setup code copied from your other browser or device..."
              value={setupCodeInput}
              onChange={(e) => setSetupCodeInput(e.target.value)}
              disabled={isLoading}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-mono placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-950 resize-none"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 px-4 rounded-xl bg-zinc-950 text-white font-mono font-semibold text-xs shadow-xs hover:bg-zinc-800 active:scale-98 transition-all flex items-center justify-center gap-2 disabled:opacity-50 min-h-[46px] mt-2"
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

      {/* Step-by-Step Repository & Token Guide */}
      <div className="mt-6 border border-zinc-200/90 rounded-2xl bg-white overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowGuide(!showGuide)}
          className="w-full p-4 flex items-center justify-between text-left hover:bg-zinc-50/70 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-zinc-100 flex items-center justify-center text-zinc-800">
              <KeyRound size={13} />
            </div>
            <div>
              <span className="font-mono font-bold text-xs text-zinc-950 block">
                How to Connect to GitHub
              </span>
              <span className="text-[11px] font-mono text-zinc-500">
                Private repo, fine-grained PAT & security scoping
              </span>
            </div>
          </div>
          {showGuide ? (
            <ChevronUp size={15} className="text-zinc-500" />
          ) : (
            <ChevronDown size={15} className="text-zinc-500" />
          )}
        </button>

        {showGuide && (
          <div className="px-4 pb-5 pt-1 space-y-4 text-xs font-mono border-t border-zinc-100">
            {/* Step 1 */}
            <div className="space-y-1.5 pt-2">
              <div className="flex items-center gap-2 text-zinc-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] flex items-center justify-center">
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
                <code className="bg-zinc-100 px-1 py-0.5 rounded text-zinc-800">my-resumes</code>
                ).
              </p>
              <div className="ml-7 p-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-[11px] text-zinc-700">
                <span className="font-bold text-zinc-950">Important:</span> Choose{' '}
                <span className="font-bold text-zinc-950">Private</span> so your personal resumes,
                contact details, and career notes are never publicly visible on the internet.
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] flex items-center justify-center">
                  2
                </span>
                <span>Generate a Fine-Grained Token</span>
              </div>
              <p className="text-zinc-600 pl-7 leading-relaxed">
                In GitHub, go to{' '}
                <a
                  href="https://github.com/settings/tokens?type=beta"
                  target="_blank"
                  rel="noreferrer"
                  className="text-zinc-950 underline underline-offset-2 inline-flex items-center gap-0.5"
                >
                  Settings &gt; Developer Settings &gt; Personal access tokens &gt; Fine-grained
                  tokens <ExternalLink size={10} />
                </a>{' '}
                and click{' '}
                <span className="font-medium text-zinc-800">&quot;Generate new token&quot;</span>.
              </p>
            </div>

            {/* Step 3 */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-zinc-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] flex items-center justify-center">
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
                    <span className="font-semibold text-zinc-950">
                      &quot;Only select repositories&quot;
                    </span>{' '}
                    and choose your private repo. This guarantees storr. cannot access any other repo
                    in your account.
                  </li>
                  <li>
                    <span className="font-bold text-zinc-900">Repository permissions:</span> Find{' '}
                    <span className="font-semibold text-zinc-950">Contents</span> and select{' '}
                    <span className="font-semibold text-zinc-950">&quot;Read and write&quot;</span>.
                    No other permissions are needed.
                  </li>
                </ul>
              </div>
            </div>

            {/* Step 4 */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center gap-2 text-zinc-900 font-bold">
                <span className="w-5 h-5 rounded-full bg-zinc-950 text-white text-[10px] flex items-center justify-center">
                  4
                </span>
                <span>Permanent Local Storage Guarantee</span>
              </div>
              <p className="text-zinc-600 pl-7 leading-relaxed text-[11px]">
                Once entered, your token is dual-persisted locally in your browser&apos;s sandboxed{' '}
                <span className="font-medium text-zinc-900">localStorage</span> and{' '}
                <span className="font-medium text-zinc-900">IndexedDB</span>. It will{' '}
                <span className="font-bold text-zinc-950">never be forgotten</span> across sessions
                or browser restarts unless you manually click{' '}
                <span className="font-medium text-zinc-900">&quot;Disconnect Private Repository&quot;</span>{' '}
                in Settings.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Architecture footnote */}
      <div className="mt-8 text-center border-t border-zinc-100 pt-5 text-[11px] font-mono text-zinc-400">
        <p>Private GitHub API • IndexedDB Cache • Zero Cloud Cost</p>
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
