import { asRecord } from './json.ts';

export function pinnedPnpmVersion(packageJson: unknown): string | null {
  const packageManager = asRecord(packageJson).packageManager;
  if (typeof packageManager !== 'string') return null;
  return packageManager.split('@')[1] || null;
}
