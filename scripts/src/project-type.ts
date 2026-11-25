import { asRecord } from './json.ts';

export type ProjectType = 'nextjs' | 'elysia' | 'generic';

export function detectProjectType(packageJson: unknown): ProjectType {
  const manifest = asRecord(packageJson);
  const dependencies = { ...asRecord(manifest.dependencies), ...asRecord(manifest.devDependencies) };
  if ('next' in dependencies) return 'nextjs';
  if ('elysia' in dependencies) return 'elysia';
  return 'generic';
}
