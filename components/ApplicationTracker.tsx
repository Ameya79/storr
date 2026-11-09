'use client';

import React, { useState } from 'react';
import { useVault, selectApplicationsByVersion } from '@/store/useVault';
import { Application, ApplicationStatus } from '@/types';
import { showToast } from '@/components/ToastContainer';
import {
  Briefcase,
  Plus,
  ExternalLink,
  Calendar,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

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

export function ApplicationTracker({
  versionId,
  versionLabel,
}: {
  versionId: string;
  versionLabel?: string;
}) {
  const { manifest, addApplication, updateApplication, deleteApplication } = useVault();
  const applications = selectApplicationsByVersion(manifest, versionId);

  const [isExpanded, setIsExpanded] = useState(true);
  const [modalMode, setModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingApp, setEditingApp] = useState<Application | null>(null);

  // Form states
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState<ApplicationStatus>('applied');
  const [appliedDate, setAppliedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [jobUrl, setJobUrl] = useState('');
  const [notes, setNotes] = useState('');

  const openAddModal = () => {
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
    if (!company.trim() || !role.trim()) {
      showToast({ type: 'error', message: 'Company and Role are required' });
      return;
    }

    if (modalMode === 'add') {
      await addApplication({
        versionId,
        company: company.trim(),
        role: role.trim(),
        status,
        appliedDate,
        jobUrl: jobUrl.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      showToast({ type: 'success', message: `Tracked application for ${company.trim()}` });
    } else if (modalMode === 'edit' && editingApp) {
      await updateApplication(editingApp.id, {
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
      message: `${app.company} status updated to ${STATUS_CONFIG[nextStatus].label}`,
    });
  };

  // Group counts by status
  const counts = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {} as Record<ApplicationStatus, number>);

  return (
    <div className="w-full rounded-2xl bg-white border border-zinc-200/90 shadow-2xs overflow-hidden font-mono text-xs">
      {/* Header Bar */}
      <div className="p-4 bg-zinc-50/70 border-b border-zinc-200/80 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
            <Briefcase size={14} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-zinc-950 text-sm">
                Applications Sent with this Resume
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-zinc-200 text-zinc-700 text-[10px] font-semibold">
                {applications.length}
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Tied directly to commit version {versionLabel ? `"${versionLabel}"` : ''}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white font-medium text-xs shadow-xs transition-all active:scale-98"
          >
            <Plus size={13} />
            <span>Track Application</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100 transition-colors"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Status Breakdown Pills */}
      {isExpanded && applications.length > 0 && (
        <div className="px-4 py-2 bg-white border-b border-zinc-100 flex items-center gap-2 overflow-x-auto no-scrollbar text-[11px]">
          <span className="text-zinc-400 font-medium">Pipeline:</span>
          {(Object.keys(STATUS_CONFIG) as ApplicationStatus[]).map((st) => {
            const count = counts[st] || 0;
            if (count === 0) return null;
            const config = STATUS_CONFIG[st];
            return (
              <span
                key={st}
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-medium ${config.badgeClass}`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${config.colorDot}`} />
                <span>
                  {count} {config.label}
                </span>
              </span>
            );
          })}
        </div>
      )}

      {/* Applications List */}
      {isExpanded && (
        <div className="p-4 space-y-3">
          {applications.length === 0 ? (
            <div className="py-8 text-center space-y-2 border border-dashed border-zinc-200 rounded-xl bg-zinc-50/50">
              <p className="text-zinc-600 font-medium">No applications tracked with this resume yet</p>
              <p className="text-[11px] text-zinc-400 max-w-sm mx-auto">
                Record companies you applied to with this specific resume version so you know exactly which version they received.
              </p>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-300 text-zinc-900 bg-white hover:bg-zinc-50 transition-colors text-[11px] font-medium mt-1"
              >
                <Plus size={12} />
                <span>Track First Application</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {applications.map((app) => {
                const config = STATUS_CONFIG[app.status];
                return (
                  <div
                    key={app.id}
                    className="p-3.5 rounded-xl border border-zinc-200 bg-white shadow-2xs hover:border-zinc-300 transition-all flex flex-col justify-between space-y-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-zinc-950 text-sm truncate">
                            {app.company}
                          </h4>
                          {app.jobUrl && (
                            <a
                              href={app.jobUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-zinc-400 hover:text-zinc-950 transition-colors"
                              title="Open Job Posting"
                            >
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                        <p className="text-zinc-600 font-medium text-xs truncate mt-0.5">
                          {app.role}
                        </p>
                        <div className="flex items-center gap-1.5 text-zinc-400 text-[10px] mt-1">
                          <Calendar size={11} />
                          <span>Applied {app.appliedDate}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(app)}
                          className="p-1 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-md transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(app.id, app.company)}
                          className="p-1 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {app.notes && (
                      <p className="text-[11px] text-zinc-600 bg-zinc-50 p-2 rounded-lg border border-zinc-100 leading-relaxed">
                        {app.notes}
                      </p>
                    )}

                    {/* Quick 1-Click Status Transitions */}
                    <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2">
                      <span className="text-[10px] text-zinc-400">Status:</span>
                      <div className="flex items-center gap-1 flex-wrap">
                        {(Object.keys(STATUS_CONFIG) as ApplicationStatus[]).map((st) => {
                          const isCurrent = app.status === st;
                          return (
                            <button
                              key={st}
                              type="button"
                              onClick={() => handleStatusChange(app, st)}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-all ${
                                isCurrent
                                  ? `${STATUS_CONFIG[st].badgeClass} font-bold ring-1 ring-zinc-400`
                                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
                              }`}
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
      )}

      {/* Add / Edit Application Modal */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-2xl border border-zinc-200 shadow-floating p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-zinc-950 text-white flex items-center justify-center">
                  <Briefcase size={14} />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-950">
                    {modalMode === 'add' ? 'Track New Application' : 'Edit Application'}
                  </h3>
                  <p className="text-[11px] text-zinc-500">
                    Linked to this resume version
                  </p>
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

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-zinc-700 mb-1 font-medium">Company Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stripe, Linear, Vercel"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
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
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-700 mb-1 font-medium">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
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
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                  >
                  </input>
                </div>
              </div>

              <div>
                <label className="block text-zinc-700 mb-1 font-medium">Job URL (optional)</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={jobUrl}
                  onChange={(e) => setJobUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="block text-zinc-700 mb-1 font-medium">Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="Referral name, salary band, recruiter contact, interview notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-900 focus:bg-white resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="px-3 py-2 rounded-xl border border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition-colors font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-zinc-950 text-white font-medium text-xs hover:bg-zinc-800 transition-colors shadow-xs"
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

