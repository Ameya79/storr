export type ISODate = string; // "2026-11-06"
export type ISOTime = string; // "2026-11-06T00:00:00.000Z"

/**
 * Branch represents a resume versioning track (e.g. "main", "product-lead", "fintech").
 * Maintained with full backward compatibility to existing Track manifests.
 */
export interface Branch {
  id: string;
  name: string;
  emoji?: string;
  color: string;
  order: number;
  archived: boolean;
  createdAt: ISOTime;
  updatedAt: ISOTime;
  deletedAt?: ISOTime | null;
}

// Backward-compatible alias
export type Track = Branch;

export interface Version {
  id: string;
  trackId: string; // branch ID
  label: string;   // commit message / version label
  note?: string;
  tags?: string[];
  versionDate: ISODate;
  fileName: string;
  mime: string;
  sizeBytes: number;
  sha256: string;
  filePath: string;
  thumbPath: string | null;
  createdAt: ISOTime;
  updatedAt: ISOTime;
  deletedAt: ISOTime | null;
}

export type ApplicationStatus = 'applied' | 'interviewing' | 'offer' | 'rejected' | 'ghosted';

export interface Application {
  id: string;
  versionId: string; // Links this application to the specific resume version used
  company: string;
  role: string;
  status: ApplicationStatus;
  appliedDate: ISODate; // YYYY-MM-DD
  jobUrl?: string;
  notes?: string;
  createdAt: ISOTime;
  updatedAt: ISOTime;
}

export interface ProfileLink {
  id: string;
  label: string;
  url: string;
}

export interface ProfileLinks {
  linkedin?: string;
  github?: string;
  portfolio?: string;
  twitter?: string;
  custom?: ProfileLink[];
}

export interface Manifest {
  schema: 1;
  updatedAt: ISOTime;
  tracks: Branch[];
  versions: Version[];
  purgedVersionIds?: string[];
  purgedTrackIds?: string[];
  applications?: Application[];
  links?: ProfileLinks;
}

export type SyncStatus = 'synced' | 'syncing' | 'offline' | 'error' | 'authError';

export interface GithubConfig {
  owner: string;
  repo: string;
  token: string;
}

export type OutboxOp =
  | { type: 'UPSERT_TRACK'; track: Branch; id: string }
  | { type: 'UPSERT_VERSION'; version: Version; id: string }
  | { type: 'SOFT_DELETE_VERSION'; versionId: string; deletedAt: ISOTime }
  | { type: 'RESTORE_VERSION'; versionId: string; updatedAt: ISOTime }
  | { type: 'PURGE_VERSION'; versionId: string }
  | { type: 'UPLOAD_BLOB'; path: string; key: string }
  | { type: 'DELETE_BLOB'; path: string };

export const BRANCH_PALETTE = [
  '#18181B', // Graphite / Main
  '#2563EB', // Blue
  '#059669', // Emerald
  '#D97706', // Amber
  '#E11D48', // Rose
  '#0891B2', // Cyan
  '#475569', // Slate
  '#6D28D9', // Purple
] as const;

export const PALETTE = BRANCH_PALETTE;
