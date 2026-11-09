'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useVault, selectAllApplications } from '@/store/useVault';
import { Application, ApplicationStatus, Version, Branch } from '@/types';
import { showToast } from '@/components/ToastContainer';
import { GitBranchIcon } from '@/components/SvgIcons';
import {
  Briefcase,
  Plus,
  ExternalLink,
  Calendar,
  Edit2,
  Trash2,
  X,
  FileText,
  Clock,
  Sparkles,
} from 'lucide-react';
import clsx from 'clsx';

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; colorDot: string; barColor: string; badgeClass: string }
> = {
  applied: {
    label: 'Applied',
    colorDot: 'bg-zinc-400',
    barColor: 'bg-zinc-400',
    badgeClass: 'bg-zinc-100 text-zinc-800 border-zinc-300',
  },
  interviewing: {
    label: 'Interviewing',
    colorDot: 'bg-blue-600',
    barColor: 'bg-blue-600',
    badgeClass: 'bg-blue-50 text-blue-800 border-blue-200',
  },
  offer: {
    label: 'Offer',
    colorDot: 'bg-emerald-600',
    barColor: 'bg-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    colorDot: 'bg-rose-500',
    barColor: 'bg-rose-500',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  ghosted: {
    label: 'Ghosted',
    colorDot: 'bg-amber-500',
    barColor: 'bg-amber-500',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
};

export function ApplicationsPipeline() {
  const { manifest, addApplication, updateApplication, deleteApplication } = useVault();
  const allApplications = useMemo(() => selectAllApplications(manifest), [manifest]);

  const versions = useMemo(() => {
    if (!manifest) return [];
    const purgedSet = new Set(manifest.purgedVersionIds || []);
    return manifest.versions.filter((v) => !v.deletedAt && !purgedSet.has(v.id));
  }, [manifest]);

  const versionMap = useMemo(() => {
    return new Map(versions.map((v) => [v.id, v]));
  }, [versions]);

  const branchMap = useMemo(() => {
    if (!manifest) return new Map<string, Branch>();
    return new Map(manifest.tracks.map((t) => [t.id, t]));
  }, [manifest]);

  const [statusFilter, setStatusFilter] = useState<'all' | ApplicationStatus>('all');
  const [versionFilter, setVersionFilter] = useState<string>('all');
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingApp, setEditingApp] = useState<Application | null>(null);

  // Form states
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('applied');
  const [appliedDate, setAppliedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [jobUrl, setJobUrl] = useState('');
  const [notes, setNotes] = useState('');

  // Filtered applications
  const filteredApps = useMemo(() => {
    return allApplications.filter((app) => {
      const matchStatus = statusFilter === 'all' || app.status === statusFilter;
      const matchVersion = versionFilter === 'all' || app.versionId === versionFilter;
      return matchStatus && matchVersion;
    });
  }, [allApplications, statusFilter, versionFilter]);

  // Counts by status
  const counts = useMemo(() => {
    const c: Record<ApplicationStatus | 'all', number> = {
      all: allApplications.length,
      applied: 0,
      interviewing: 0,
      offer: 0,
      rejected: 0,
      ghosted: 0,
    };
    for (const app of allApplications) {
      if (c[app.status] !== undefined) {
        c[app.status]++;
      }
    }
    return c;
  }, [allApplications]);

  const openAddModal = () => {
    setSelectedVersionId(versions[0]?.id || '');
    setCompany('');
    setRole('');
    setStatus('applied');
    setAppliedDate(new Date().toISOString().split('T')[0]);
    setJobUrl('');
    setNotes('');
    setModalMode('add');
  };

  const openEditModal = (app: Application) => {
    setEditingApp(app);
    setSelectedVersionId(app.versionId);
    setCompany(app.company);
    setRole(app.role);
    setStatus(app.status);
    setAppliedDate(app.appliedDate);
    setJobUrl(app.jobUrl || '');
    setNotes(app.notes || '');
    setModalMode('edit');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company.trim() || !role.trim() || !selectedVersionId) {
      showToast({ type: 'error', message: 'Please fill all required fields' });
      return;
    }

    if (modalMode === 'add') {
      await addApplication({
        versionId: selectedVersionId,
        company: company.trim(),
        role: role.trim(),
        status,
        appliedDate,
        jobUrl: jobUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      showToast({ type: 'success', message: `Added application for ${company.trim()}` });
    } else if (modalMode === 'edit' && editingApp) {
      await updateApplication(editingApp.id, {
        versionId: selectedVersionId,
        company: company.trim(),
        role: role.trim(),
        status,
        appliedDate,
        jobUrl: jobUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      showToast({ type: 'success', message: 'Application updated' });
    }

    setModalMode(null);
    setEditingApp(null);
  };

  const handleDelete = async (id: string, appCompany: string) => {
    if (window.confirm(`Delete application for ${appCompany}?`)) {
      await deleteApplication(id);
      showToast({ type: 'info', message: 'Application removed' });
    }
  };

  const handleStatusChange = async (app: Application, nextStatus: ApplicationStatus) => {
    await updateApplication(app.id, { status: nextStatus });
    showToast({
      type: 'success',
      message: `${app.company} updated to ${STATUS_CONFIG[nextStatus].label}`,
    });
  };

  return (
    <div className="space-y-4 font-mono">
      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center shrink-0 shadow-subtle">
            <Briefcase size={15} />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-950 tracking-tight leading-tight">
              Application Tracker
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Career pipeline tied to specific resume commits
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-semibold shadow-xs transition-all active:scale-98 min-h-[44px]"
        >
          <Plus size={14} />
          <span>Track Application</span>
        </button>
      </div>

      {/* High-Density Summary Ribbon */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 text-xs">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-zinc-200 shadow-2xs shrink-0">
          <span className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Total</span>
          <span className="font-bold text-zinc-950 font-mono">{counts.all}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50/70 border border-blue-200 text-blue-900 shadow-2xs shrink-0">
          <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
          <span className="text-[11px] font-medium">Interviewing</span>
          <span className="font-bold font-mono ml-0.5">{counts.interviewing}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 shadow-2xs shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
          <span className="text-[11px] font-medium">Offers</span>
          <span className="font-bold font-mono ml-0.5">{counts.offer}</span>
        </div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-700 shadow-2xs shrink-0">
          <span className="w-2 h-2 rounded-full bg-zinc-400 shrink-0" />
          <span className="text-[11px] font-medium">Applied</span>
          <span className="font-bold font-mono ml-0.5">{counts.applied}</span>
        </div>
        {(counts.rejected > 0 || counts.ghosted > 0) && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-50/80 border border-zinc-200 text-zinc-500 shadow-2xs shrink-0">
            <span className="text-[11px] font-medium">Archived</span>
            <span className="font-mono text-zinc-700 font-bold">
              {counts.rejected + counts.ghosted}
            </span>
          </div>
        )}
      </div>

      {/* Filter Tabs & Resume Selector */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1">
        {/* Stage Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 text-xs">
          {(['all', 'interviewing', 'offer', 'applied', 'rejected', 'ghosted'] as const).map(
            (st) => {
              const isActive = statusFilter === st;
              const count = counts[st];
              const config = st !== 'all' ? STATUS_CONFIG[st] : null;

              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={clsx(
                    'px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 min-h-[36px]',
                    isActive
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs font-semibold'
                      : 'bg-white text-zinc-600 border-zinc-200 hover:border-zinc-300'
                  )}
                >
                  {config && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-white' : config.colorDot
                      }`}
                    />
                  )}
                  <span className="capitalize">{st === 'all' ? 'All' : config?.label}</span>
                  <span
                    className={clsx(
                      'text-[10px] px-1 rounded font-mono',
                      isActive ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-100 text-zinc-500'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            }
          )}
        </div>

        {/* Resume Version Filter Dropdown */}
        {versions.length > 1 && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-zinc-400 shrink-0">Resume:</span>
            <select
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg bg-white border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:ring-1 focus:ring-zinc-900 min-h-[36px]"
            >
              <option value="all">All Resumes ({allApplications.length})</option>
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label} ({allApplications.filter((a) => a.versionId === v.id).length})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Reflog Applications Stream */}
      <div className="space-y-3">
        {filteredApps.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-zinc-200 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center mx-auto">
              <Briefcase size={18} />
            </div>
            <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-wider">
              {allApplications.length === 0
                ? 'No applications tracked yet'
                : 'No applications match filter'}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
              {allApplications.length === 0
                ? 'Log applications with company, interview stage, and the exact resume commit sent.'
                : 'Try selecting another status tab or resume version above.'}
            </p>
            {allApplications.length === 0 && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-semibold shadow-xs hover:bg-zinc-800 transition-colors mt-1 min-h-[44px]"
              >
                <Plus size={14} />
                <span>Track First Application</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredApps.map((app) => {
              const config = STATUS_CONFIG[app.status];
              const linkedVersion = versionMap.get(app.versionId);
              const linkedBranch = linkedVersion ? branchMap.get(linkedVersion.trackId) : null;

              return (
                <div
                  key={app.id}
                  className="relative bg-white rounded-2xl border border-zinc-200/90 hover:border-zinc-300 shadow-2xs hover:shadow-subtle transition-all p-4 sm:p-5 flex flex-col justify-between space-y-3"
                >
                  {/* Left colored stage accent indicator */}
                  <div
                    className={clsx(
                      'absolute left-0 top-3 bottom-3 w-1 rounded-r-full',
                      config.barColor
                    )}
                  />

                  {/* Top Row: Company, Role & Inline Stage Control */}
                  <div className="space-y-2 pl-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm sm:text-base text-zinc-950 tracking-tight leading-snug">
                            {app.company}
                          </h3>
                          {app.jobUrl && (
                            <a
                              href={app.jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-400 hover:text-zinc-950 p-1 rounded transition-colors"
                              title="Open Job Posting"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-zinc-700 font-medium mt-0.5">
                          {app.role}
                        </p>
                      </div>

                      {/* Inline Stage Dropdown + Actions */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="relative">
                          <select
                            value={app.status}
                            onChange={(e) =>
                              handleStatusChange(app, e.target.value as ApplicationStatus)
                            }
                            className={clsx(
                              'appearance-none pl-2.5 pr-6 py-1 rounded-lg border text-xs font-mono font-bold cursor-pointer transition-all shadow-2xs focus:outline-none focus:ring-1 focus:ring-zinc-900 min-h-[36px]',
                              config.badgeClass
                            )}
                          >
                            <option value="applied">Applied</option>
                            <option value="interviewing">Interviewing</option>
                            <option value="offer">Offer</option>
                            <option value="rejected">Rejected</option>
                            <option value="ghosted">Ghosted</option>
                          </select>
                          <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-current opacity-60 text-[10px]">
                            ▾
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => openEditModal(app)}
                          className="p-2 text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100 rounded-lg transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title="Edit application"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(app.id, app.company)}
                          className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[38px] min-w-[38px] flex items-center justify-center"
                          title="Delete application"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Attached Resume Commit & Metadata */}
                    <div className="flex items-center gap-2.5 text-xs text-zinc-500 flex-wrap pt-0.5">
                      {linkedVersion ? (
                        <Link
                          href={`/view/${linkedVersion.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100/90 hover:bg-zinc-200/90 border border-zinc-200 text-zinc-900 text-xs font-mono transition-colors group/pill"
                        >
                          <GitBranchIcon size={12} className="text-zinc-500 group-hover/pill:text-zinc-900" />
                          <span className="font-semibold">{linkedBranch?.name || 'branch'}</span>
                          <span className="text-zinc-400">/</span>
                          <span className="truncate max-w-[130px] sm:max-w-[200px] font-medium">
                            {linkedVersion.label}
                          </span>
                          <span className="text-[10px] text-zinc-400 uppercase font-mono">
                            {linkedVersion.fileName.endsWith('.pdf') ? 'PDF' : 'DOCX'}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-zinc-400 text-xs font-mono">Archived version</span>
                      )}

                      <span className="text-zinc-300">•</span>

                      <div className="flex items-center gap-1 text-zinc-400 text-[11px] font-mono">
                        <Calendar size={11} />
                        <span>{app.appliedDate}</span>
                      </div>
                    </div>

                    {/* Notes block */}
                    {app.notes && (
                      <div className="mt-2 text-xs font-mono text-zinc-700 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 leading-relaxed">
                        {app.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add / Edit Application Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-floating p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
                  <Briefcase size={15} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-950">
                    {modalMode === 'add' ? 'Track New Application' : 'Edit Application'}
                  </h3>
                  <p className="text-[11px] text-zinc-500">Record job search progress</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-950 hover:bg-zinc-100"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-zinc-700 mb-1 font-medium">
                  Resume Version Used *
                </label>
                <select
                  required
                  value={selectedVersionId}
                  onChange={(e) => setSelectedVersionId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white min-h-[44px]"
                >
                  {versions.length === 0 ? (
                    <option value="">No active resume versions available</option>
                  ) : (
                    versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label} ({v.fileName})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-zinc-700 mb-1 font-medium">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stripe, Linear, Vercel"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-zinc-700 mb-1 font-medium">Role / Job Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Senior Software Engineer"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white min-h-[44px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-700 mb-1 font-medium">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white min-h-[44px]"
                  >
                    <option value="applied">Applied</option>
                    <option value="interviewing">Interviewing</option>
                    <option value="offer">Offer</option>
                    <option value="rejected">Rejected</option>
                    <option value="ghosted">Ghosted</option>
                  </select>
                </div>

                <div>
                  <label className="block text-zinc-700 mb-1 font-medium">Applied Date</label>
                  <input
                    type="date"
                    required
                    value={appliedDate}
                    onChange={(e) => setAppliedDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white min-h-[44px]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-700 mb-1 font-medium">Job URL (optional)</label>
                <input
                  type="url"
                  placeholder="https://jobs.lever.co/..."
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-zinc-700 mb-1 font-medium">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Referral name, recruiter contact, salary band, questions..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3.5 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 font-medium text-xs min-h-[44px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-zinc-950 text-white font-medium text-xs hover:bg-zinc-800 shadow-xs min-h-[44px]"
                >
                  {modalMode === 'add' ? 'Save Application' : 'Update Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
