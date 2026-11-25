import { isRecord } from './json.ts';

export type SecretsPayload = Record<string, string | null>;

export function parseSecretNames(output: string): string[] {
  const start = output.indexOf('[');
  const end = output.lastIndexOf(']');
  if (start === -1 || end < start) {
    throw new Error('wrangler secret list did not print a JSON array');
  }
  const parsed: unknown = JSON.parse(output.slice(start, end + 1));
  if (!Array.isArray(parsed)) {
    throw new Error('wrangler secret list did not print a JSON array');
  }
  return parsed.flatMap((item) => (isRecord(item) && typeof item.name === 'string' ? [item.name] : []));
}

export function buildSecretsPayload(kept: Record<string, string>, existing: string[]): SecretsPayload {
  const payload: SecretsPayload = { ...kept };
  for (const name of existing) {
    if (!Object.hasOwn(kept, name)) {
      payload[name] = null;
    }
  }
  return payload;
}

export function staleNames(payload: SecretsPayload): string[] {
  return Object.entries(payload)
    .filter(([, value]) => value === null)
    .map(([name]) => name);
}
