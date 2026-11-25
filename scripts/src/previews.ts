import { isRecord } from './json.ts';

export interface PreviewItem {
  id: string;
  time: string;
}

export function slugOf(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9-]/g, '-');
}

function firstString(...values: unknown[]): string {
  return values.find((value): value is string => typeof value === 'string' && value !== '') ?? '';
}

export function parsePreviews(body: unknown): PreviewItem[] {
  const items = Array.isArray(body) ? body : isRecord(body) && Array.isArray(body.result) ? body.result : [];
  return items.flatMap((item: unknown) => {
    if (!isRecord(item)) return [];
    const id = firstString(item.name, item.id);
    return id ? [{ id, time: firstString(item.created_on, item.modified_on) }] : [];
  });
}

export function selectStalePreviews(previews: PreviewItem[], keep: number, currentBranch: string): string[] {
  const slug = slugOf(currentBranch);
  return [...previews]
    .sort((a, b) => (a.time < b.time ? 1 : a.time > b.time ? -1 : 0))
    .slice(keep)
    .map((preview) => preview.id)
    .filter((id) => id !== currentBranch && id !== slug);
}

export function selectStaleBranches(branchesNewestFirst: string[], keep: number, currentBranch: string): string[] {
  return branchesNewestFirst
    .filter((branch) => branch !== 'HEAD' && branch !== 'main')
    .slice(keep)
    .filter((branch) => branch !== currentBranch)
    .map(slugOf);
}
