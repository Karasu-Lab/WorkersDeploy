const INFRASTRUCTURE_NAMES = [/^CLOUDFLARE_/, /^GITHUB_/, /^ACTIONS_/, /^RUNNER_/, /^NODE_AUTH_TOKEN$/, /^github_token$/i];

export interface ResolveOptions {
  vars: Record<string, string>;
  secrets: Record<string, string>;
  exclude: string;
  isDeployedVar: (name: string) => boolean;
}

export function parseNames(text: string): string[] {
  return text.split(/\s+/).filter((name) => name !== '');
}

export function resolveWorkerEnvironment(options: ResolveOptions): { vars: Record<string, string>; secrets: Record<string, string> } {
  const excluded = new Set(parseNames(options.exclude));
  const isPassed = (name: string) => !excluded.has(name) && !INFRASTRUCTURE_NAMES.some((pattern) => pattern.test(name)) && !options.isDeployedVar(name);

  const secrets: Record<string, string> = {};
  for (const [name, value] of Object.entries(options.secrets).sort(([a], [b]) => a.localeCompare(b))) {
    if (value !== '' && isPassed(name)) {
      secrets[name] = value;
    }
  }

  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(options.vars).sort(([a], [b]) => a.localeCompare(b))) {
    if (value !== '' && isPassed(name) && !Object.hasOwn(secrets, name)) {
      vars[name] = value;
    }
  }
  return { vars, secrets };
}
