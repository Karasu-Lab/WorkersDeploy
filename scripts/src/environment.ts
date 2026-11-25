export type DeployMode = 'production' | 'preview';

export function resolveMode(requested: string, refName: string, defaultBranch: string): DeployMode {
  if (requested === 'production' || requested === 'preview') {
    return requested;
  }
  if (requested !== '' && requested !== 'auto') {
    throw new Error(`mode must be auto, production or preview, got "${requested}"`);
  }
  return refName === defaultBranch ? 'production' : 'preview';
}
