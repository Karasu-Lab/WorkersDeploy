export interface SecretSources {
  vars: Record<string, string>;
  secrets: Record<string, string>;
  processEnv: Record<string, string | undefined>;
}

export interface ResolveOptions {
  secretNames: string;
  sources: SecretSources;
  isDeployedVar: (name: string) => boolean;
}

export function parseNames(text: string): string[] {
  return text.split(/\s+/).filter((name) => name !== '');
}

export function resolveWorkerSecrets(options: ResolveOptions): { resolved: Record<string, string>; missing: string[] } {
  const { sources, isDeployedVar } = options;
  const names = [...new Set(parseNames(options.secretNames).filter((name) => !isDeployedVar(name)))].sort();

  const resolved: Record<string, string> = {};
  for (const name of names) {
    const value = sources.processEnv[name] ?? sources.secrets[name] ?? sources.vars[name] ?? '';
    if (value !== '') {
      resolved[name] = value;
    }
  }
  return { resolved, missing: names.filter((name) => !Object.hasOwn(resolved, name)) };
}
