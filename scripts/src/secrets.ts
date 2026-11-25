export interface SecretSources {
  vars: Record<string, string>;
  secrets: Record<string, string>;
  processEnv: Record<string, string | undefined>;
}

export interface ResolveOptions {
  secretNames: string;
  declared: string[];
  sources: SecretSources;
  isDeployedVar: (name: string) => boolean;
}

export function parseNames(text: string): string[] {
  return text.split(/\s+/).filter((name) => name !== '');
}

export function parseDeclaredNames(envFileText: string): string[] {
  return envFileText.split('\n').flatMap((line) => {
    const name = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=/.exec(line)?.[1];
    return name ? [name] : [];
  });
}

export function resolveWorkerSecrets(options: ResolveOptions): { resolved: Record<string, string>; missing: string[] } {
  const { sources, isDeployedVar } = options;
  const required = parseNames(options.secretNames);
  const names = [...new Set([...required, ...options.declared.filter((name) => !isDeployedVar(name))])].sort();

  const resolved: Record<string, string> = {};
  for (const name of names) {
    const value = sources.processEnv[name] ?? sources.secrets[name] ?? sources.vars[name] ?? '';
    if (value !== '') {
      resolved[name] = value;
    }
  }
  return { resolved, missing: required.filter((name) => !Object.hasOwn(resolved, name)) };
}
