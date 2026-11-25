import { asRecord } from './json.ts';

export type DeployMode = 'production' | 'preview';

function varNames(section: unknown): string[] {
  return Object.keys(asRecord(asRecord(section).vars));
}

export function deployedVarNames(config: unknown, mode: DeployMode): string[] {
  const root = asRecord(config);
  if (mode === 'production') return varNames(root);
  return [...varNames(root.previews), ...varNames(asRecord(root.env).preview)];
}
