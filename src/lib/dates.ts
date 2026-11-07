import { format, isValid } from 'date-fns';
import { Version, ISODate } from '@/types';

/**
 * Returns today's date formatted as YYYY-MM-DD in the user's local timezone.
 */
export function getTodayISODate(): ISODate {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats an ISO date ("YYYY-MM-DD") to "dd MMM ''yy" (e.g. "12 Oct '26").
 */
export function formatVersionDate(dateStr: ISODate): string {
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(y, m - 1, d);
    if (!isValid(date)) return dateStr;
    return format(date, "d MMM ''yy");
  } catch {
    return dateStr;
  }
}

/**
 * Compares two versions for descending order:
 * Primary: versionDate descending
 * Secondary: createdAt descending (tie-breaker)
 */
export function compareVersionsDesc(a: Version, b: Version): number {
  const dateA = a?.versionDate || '';
  const dateB = b?.versionDate || '';
  if (dateA !== dateB) {
    return dateB.localeCompare(dateA);
  }
  const createdA = a?.createdAt || '';
  const createdB = b?.createdAt || '';
  return createdB.localeCompare(createdA);
}

/**
 * Computes the latest version for a set of versions (or a track).
 * Rule: non-deleted versions sorted by versionDate desc then createdAt desc, first item.
 */
export function latest(versions: Version[], trackId?: string): Version | null {
  const active = versions.filter((v) => !v.deletedAt && (!trackId || v.trackId === trackId));
  if (active.length === 0) return null;
  active.sort(compareVersionsDesc);
  return active[0];
}

export interface MonthGroup {
  monthKey: string; // e.g. "2026-11"
  header: string;   // e.g. "November 2026"
  versions: Version[];
}

/**
 * Groups active versions into sticky month buckets, sorted newest month first,
 * with versions within each month sorted newest first.
 */
export function groupByMonth(versions: Version[]): MonthGroup[] {
  const active = versions.filter((v) => !v.deletedAt);
  active.sort(compareVersionsDesc);

  const groupsMap = new Map<string, { header: string; versions: Version[] }>();

  for (const version of active) {
    const monthKey = version.versionDate.slice(0, 7); // "YYYY-MM"
    let group = groupsMap.get(monthKey);
    if (!group) {
      try {
        const [y, m] = monthKey.split('-').map(Number);
        const date = new Date(y, m - 1, 1);
        const header = isValid(date) ? format(date, 'MMMM yyyy') : monthKey;
        group = { header, versions: [] };
      } catch {
        group = { header: monthKey, versions: [] };
      }
      groupsMap.set(monthKey, group);
    }
    group.versions.push(version);
  }

  return Array.from(groupsMap.entries())
    .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
    .map(([monthKey, { header, versions: vList }]) => ({
      monthKey,
      header,
      versions: vList,
    }));
}
