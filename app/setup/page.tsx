'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { validateRepo } from '@/lib/github';
import { setConfig, getConfig, decodeSetupCode } from '@/lib/config';
import { sync } from '@/lib/sync';
import { showToast } from '@/components/ToastContainer';
import { GitBranchIcon } from '@/components/SvgIcons';
import { Github, ArrowRight, ShieldAlert, KeyRound, Database } from 'lucide-react';
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
    <div className="max-w-md mx-auto pt-6 pb-16 px-2">
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-zinc-950 text-white flex items-center justify-center mx-auto mb-4 shadow-subtle border border-zinc-800">
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
