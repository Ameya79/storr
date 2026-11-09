'use client';

import React, { useState } from 'react';
import { useVault, selectProfileLinks } from '@/store/useVault';
import { ProfileLinks, ProfileLink } from '@/types';
import { showToast } from '@/components/ToastContainer';
import {
  Linkedin,
  Github,
  Globe,
  Twitter,
  Link as LinkIcon,
  Copy,
  Check,
  ExternalLink,
  Plus,
  Settings,
  X,
} from 'lucide-react';

export function ProfileLinksBar({ compact = false }: { compact?: boolean }) {
  const { manifest, updateProfileLinks } = useVault();
  const links = selectProfileLinks(manifest);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form states for modal
  const [linkedin, setLinkedin] = useState(links.linkedin || '');
  const [github, setGithub] = useState(links.github || '');
  const [portfolio, setPortfolio] = useState(links.portfolio || '');
  const [twitter, setTwitter] = useState(links.twitter || '');
  const [customLinks, setCustomLinks] = useState<ProfileLink[]>(links.custom || []);

  const openModal = () => {
    setLinkedin(links.linkedin || '');
    setGithub(links.github || '');
    setPortfolio(links.portfolio || '');
    setTwitter(links.twitter || '');
    setCustomLinks(links.custom ? [...links.custom] : []);
    setIsModalOpen(true);
  };

  const handleCopy = (url: string, label: string, key: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedKey(key);
      showToast({ type: 'success', message: `Copied ${label} URL to clipboard` });
      setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault();
    const updated: ProfileLinks = {
      linkedin: linkedin.trim(),
      github: github.trim(),
      portfolio: portfolio.trim(),
      twitter: twitter.trim(),
      custom: customLinks.filter((c) => c.label.trim() && c.url.trim()),
    };
    await updateProfileLinks(updated);
    showToast({ type: 'success', message: 'Profile links saved permanently' });
    setIsModalOpen(false);
  };

  const addCustomLink = () => {
    setCustomLinks([
      ...customLinks,
      { id: crypto.randomUUID(), label: '', url: '' },
    ]);
  };

  const updateCustomLink = (id: string, field: 'label' | 'url', value: string) => {
    setCustomLinks(
      customLinks.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const removeCustomLink = (id: string) => {
    setCustomLinks(customLinks.filter((item) => item.id !== id));
  };

  const activeLinks = [
    { key: 'linkedin', label: 'LinkedIn', url: links.linkedin, Icon: Linkedin },
    { key: 'github', label: 'GitHub', url: links.github, Icon: Github },
    { key: 'portfolio', label: 'Portfolio', url: links.portfolio, Icon: Globe },
    { key: 'twitter', label: 'Twitter/X', url: links.twitter, Icon: Twitter },
  ].filter((item) => Boolean(item.url && item.url.trim()));

  const allEmpty = activeLinks.length === 0 && (!links.custom || links.custom.length === 0);

  return (
    <>
      <div className="w-full mb-3">
        <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar text-xs font-mono">
          <div className="flex items-center gap-1.5 flex-wrap">
            {allEmpty ? (
              <button
                type="button"
                onClick={openModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-zinc-300 hover:border-zinc-900 bg-white/70 hover:bg-white text-zinc-600 hover:text-zinc-950 transition-all text-[11px]"
              >
                <Plus size={12} />
                <span>Add Career Links (LinkedIn, Portfolio, GitHub)</span>
              </button>
            ) : (
              <>
                {activeLinks.map(({ key, label, url, Icon }) => {
                  if (!url) return null;
                  const isCopied = copiedKey === key;
                  return (
                    <div
                      key={key}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200/90 bg-white text-zinc-800 shadow-2xs hover:border-zinc-400 transition-colors group"
                    >
                      <Icon size={12} className="text-zinc-600" />
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-zinc-900 hover:underline flex items-center gap-1"
                        title={url}
                      >
                        <span>{label}</span>
                        <ExternalLink size={10} className="text-zinc-400 opacity-60 group-hover:opacity-100" />
                      </a>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(url, label, key, e)}
                        className="ml-1 p-0.5 text-zinc-400 hover:text-zinc-900 transition-colors"
                        title="Copy URL"
                      >
                        {isCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      </button>
                    </div>
                  );
                })}

                {(links.custom || []).map((c) => {
                  if (!c.url) return null;
                  const isCopied = copiedKey === c.id;
                  return (
                    <div
                      key={c.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200/90 bg-white text-zinc-800 shadow-2xs hover:border-zinc-400 transition-colors group"
                    >
                      <LinkIcon size={12} className="text-zinc-600" />
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium text-zinc-900 hover:underline flex items-center gap-1"
                        title={c.url}
                      >
                        <span>{c.label || 'Link'}</span>
                        <ExternalLink size={10} className="text-zinc-400 opacity-60 group-hover:opacity-100" />
                      </a>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(c.url, c.label || 'Link', c.id, e)}
                        className="ml-1 p-0.5 text-zinc-400 hover:text-zinc-900 transition-colors"
                        title="Copy URL"
                      >
                        {isCopied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                      </button>
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={openModal}
                  className="inline-flex items-center gap-1 p-1 px-2 rounded-lg text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 border border-transparent hover:border-zinc-200 transition-all text-[11px]"
                  title="Manage Links"
                >
                  <Settings size={11} />
                  <span>Edit Links</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Profile Links Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-floating p-5 space-y-4 font-mono">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
                  <LinkIcon size={14} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-950">Career Profile Links</h3>
                  <p className="text-[11px] text-zinc-500">Stored permanently in your vault</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveModal} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-600 mb-1 font-medium">LinkedIn URL</label>
                <input
                  type="url"
                  placeholder="https://linkedin.com/in/username"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-zinc-600 mb-1 font-medium">GitHub URL</label>
                <input
                  type="url"
                  placeholder="https://github.com/username"
                  value={github}
                  onChange={(e) => setGithub(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-zinc-600 mb-1 font-medium">Portfolio / Website</label>
                <input
                  type="url"
                  placeholder="https://yourname.com"
                  value={portfolio}
                  onChange={(e) => setPortfolio(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-zinc-600 mb-1 font-medium">Twitter / X</label>
                <input
                  type="url"
                  placeholder="https://x.com/username"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              {/* Custom Links */}
              <div className="space-y-2 pt-1 border-t border-zinc-100">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-600 font-medium">Custom Links</span>
                  <button
                    type="button"
                    onClick={addCustomLink}
                    className="inline-flex items-center gap-1 text-[11px] text-zinc-900 hover:underline"
                  >
                    <Plus size={11} />
                    <span>Add Link</span>
                  </button>
                </div>

                {customLinks.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Label (e.g. Substack)"
                      value={item.label}
                      onChange={(e) => updateCustomLink(item.id, 'label', e.target.value)}
                      className="w-1/3 px-2.5 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                    />
                    <input
                      type="url"
                      placeholder="https://..."
                      value={item.url}
                      onChange={(e) => updateCustomLink(item.id, 'url', e.target.value)}
                      className="flex-1 px-2.5 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomLink(item.id)}
                      className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-zinc-950 text-white font-medium text-xs hover:bg-zinc-800 transition-colors shadow-xs"
                >
                  Save Links
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

