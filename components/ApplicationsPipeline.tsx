'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useVault, selectAllApplications } from '@/store/useVault';
import { Application, ApplicationStatus, Version } from '@/types';
import { showToast } from '@/components/ToastContainer';
import {
  Briefcase,
  Plus,
  ExternalLink,
  Calendar,
  Edit2,
  Trash2,
  X,
  FileText,
} from 'lucide-react';
import clsx from 'clsx';

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; colorDot: string; badgeClass: string }
> = {
  applied: {
    label: 'Applied',
    colorDot: 'bg-zinc-500',
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200',
  },
  interviewing: {
    label: 'Interviewing',
    colorDot: 'bg-blue-600',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  offer: {
    label: 'Offer',
    colorDot: 'bg-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    colorDot: 'bg-rose-600',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  ghosted: {
    label: 'Ghosted',
    colorDot: 'bg-amber-600',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
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
    <div className="space-y-5 font-mono">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-950 text-white flex items-center justify-center flex-shrink-0 shadow-subtle">
            <Briefcase size={16} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-zinc-950 tracking-tight leading-tight">
              Job Application Tracker
            </h2>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Track companies, interview stages &amp; resume version sent
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-950 text-white hover:bg-zinc-800 text-xs font-semibold shadow-xs transition-all active:scale-98 min-h-[44px]"
        >
          <Plus size={15} />
          <span>Track Application</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3.5 rounded-xl bg-white border border-zinc-200 shadow-2xs">
          <span className="text-[10px] text-zinc-400 uppercase font-semibold">Total Tracked</span>
          <p className="text-xl sm:text-2xl font-bold text-zinc-950 mt-1">{counts.all}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/60 shadow-2xs">
          <span className="text-[10px] text-blue-700 uppercase font-semibold">Interviewing</span>
          <p className="text-xl sm:text-2xl font-bold text-blue-900 mt-1">{counts.interviewing}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-emerald-50/50 border border-emerald-200/60 shadow-2xs">
          <span className="text-[10px] text-emerald-700 uppercase font-semibold">Offers</span>
          <p className="text-xl sm:text-2xl font-bold text-emerald-900 mt-1">{counts.offer}</p>
        </div>
        <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 shadow-2xs">
          <span className="text-[10px] text-zinc-500 uppercase font-semibold">Applied</span>
          <p className="text-xl sm:text-2xl font-bold text-zinc-800 mt-1">{counts.applied}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pb-1">
        {/* Status Filters */}
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
                      ? 'bg-zinc-950 text-white border-zinc-950 shadow-xs'
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
                      'text-[10px] px-1 rounded',
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
          <div className="flex items-center gap-2">
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

      {/* Applications List */}
      <div className="space-y-3">
        {filteredApps.length === 0 ? (
          <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-zinc-200 space-y-3">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 text-zinc-500 flex items-center justify-center mx-auto">
              <Briefcase size={22} />
            </div>
            <h3 className="text-sm font-bold text-zinc-900">
              {allApplications.length === 0
                ? 'No job applications tracked yet'
                : 'No applications match this filter'}
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto leading-relaxed">
              {allApplications.length === 0
                ? 'Record applications with the specific resume version you sent, interview notes, and direct job links.'
                : 'Try selecting a different status or resume filter above.'}
            </p>
            {allApplications.length === 0 && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-950 text-white text-xs font-semibold shadow-xs hover:bg-zinc-800 transition-colors mt-2 min-h-[44px]"
              >
                <Plus size={14} />
                <span>Track First Application</span>
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredApps.map((app) => {
              const config = STATUS_CONFIG[app.status];
              const linkedVersion = versionMap.get(app.versionId);

              return (
                <div
                  key={app.id}
                  className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-2xs hover:shadow-subtle hover:border-zinc-300 transition-all flex flex-col justify-between space-y-3.5"
                >
                  <div className="space-y-2">
                    {/* Top Row: Company & Actions */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-zinc-950 text-sm sm:text-base truncate">
                            {app.company}
                          </h3>
                          {app.jobUrl && (
                            <a
                              href={app.jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-400 hover:text-zinc-950 transition-colors p-1"
                              title="Open Job Posting"
                            >
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </div>
                        <p className="text-xs text-zinc-700 font-medium truncate mt-0.5">
                          {app.role}
                        </p>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(app)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(app.id, app.company)}
                          className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Meta: Applied Date & Resume Version Link */}
                    <div className="flex items-center gap-2 text-[11px] text-zinc-500 flex-wrap">
                      <div className="flex items-center gap-1 text-zinc-400">
                        <Calendar size={11} />
                        <span>{app.appliedDate}</span>
                      </div>
                      <span>•</span>
                      {linkedVersion ? (
                        <Link
                          href={`/view/${linkedVersion.id}`}
                          className="inline-flex items-center gap-1 text-zinc-800 hover:text-zinc-950 hover:underline text-[11px] bg-zinc-100/80 px-2 py-0.5 rounded-md border border-zinc-200/60"
                        >
                          <FileText size={10} className="text-zinc-500" />
                          <span className="truncate max-w-[140px] sm:max-w-[200px]">
                            {linkedVersion.label}
                          </span>
                        </Link>
                      ) : (
                        <span className="text-zinc-400">Archived version</span>
                      )}
                    </div>

                    {/* Notes */}
                    {app.notes && (
                      <p className="text-[11px] text-zinc-600 bg-zinc-50 p-2.5 rounded-xl border border-zinc-100 leading-relaxed">
                        {app.notes}
                      </p>
                    )}
                  </div>

                  {/* Bottom: Quick Status Switcher */}
                  <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-zinc-400 uppercase font-semibold">Stage</span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {(Object.keys(STATUS_CONFIG) as ApplicationStatus[]).map((st) => {
                        const isCurrent = app.status === st;
                        return (
                          <button
                            key={st}
                            type="button"
                            onClick={() => handleStatusChange(app, st)}
                            className={clsx(
                              'px-2 py-1 rounded text-[10px] font-medium transition-all min-h-[28px]',
                              isCurrent
                                ? `${STATUS_CONFIG[st].badgeClass} font-bold ring-1 ring-zinc-400`
                                : 'text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100'
                            )}
                          >
                            {STATUS_CONFIG[st].label}
                          </button>
                        );
                      })}
                    </div>
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

