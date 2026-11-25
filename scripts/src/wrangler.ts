import { asRecord } from './json.ts';

function varNames(section: unknown): string[] {
  return Object.keys(asRecord(asRecord(section).vars));
}

export function deployedVarNames(config: unknown, envName: string): string[] {
  const root = asRecord(config);
  if (envName === '') return varNames(root);
  return varNames(asRecord(root.env)[envName]);
}
