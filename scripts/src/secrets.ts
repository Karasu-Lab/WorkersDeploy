const EXCLUDED_CONTEXT_NAMES = new Set(['github_token', 'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'NODE_AUTH_TOKEN']);

export interface SecretSources {
  vars: Record<string, string>;
  secrets: Record<string, string>;
  callerEnv: Record<string, string>;
  processEnv: Record<string, string | undefined>;
}

export interface ResolveOptions {
  secretNames: string;
  declared: string[];
  sources: SecretSources;
  isConfigured: (name: string) => boolean;
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

function sortedUnique(names: string[]): string[] {
  return [...new Set(names)].sort();
}

export function resolveWorkerSecrets(options: ResolveOptions): { resolved: Record<string, string>; missing: string[] } {
  const { secretNames, sources, isConfigured } = options;
  const required = parseNames(secretNames);

  let declared = options.declared;
  if (secretNames === '') {
    const contextNames = Object.keys({ ...sources.vars, ...sources.secrets, ...sources.callerEnv }).filter(
      (name) => !EXCLUDED_CONTEXT_NAMES.has(name)
    );
    declared = sortedUnique([...declared, ...contextNames]);
  }

  const configured = new Set(declared.filter(isConfigured));
  const names = sortedUnique([...required, ...declared.filter((name) => !configured.has(name))]);

  const resolved: Record<string, string> = {};
  for (const name of names) {
    const value = sources.processEnv[name] ?? sources.secrets[name] ?? sources.vars[name] ?? '';
    if (value !== '') {
      resolved[name] = value;
    }
  }
  return { resolved, missing: required.filter((name) => !Object.hasOwn(resolved, name)) };
}
