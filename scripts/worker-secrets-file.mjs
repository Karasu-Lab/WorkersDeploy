import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Builds a secrets file for `wrangler secret bulk` or `wrangler preview --secrets-file`.
 *
 * Usage: node worker-secrets-file.mjs <app-dir> <output-file> <NAME...>
 *
 * Each NAME is resolved from the environment (populated from GitHub secrets by the
 * workflow). When a name has no value there, the app's committed local default —
 * the `env.local` vars in its wrangler.jsonc — is used instead, so an unset secret
 * falls back to the development value rather than disappearing. Names with neither
 * a provided value nor a default are skipped (they are optional secrets).
 * Only names and their source are logged, never values.
 */

/** Parses JSONC, tolerating comments and trailing commas. */
function parseJsonc(text) {
  let out = '';
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1] ?? '';
    if (inString) {
      out += c;
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
    } else if (c === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && next === '*') {
      i += 2;
      while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
      i++;
    } else if (c === ',') {
      // Drop the comma when the next significant character closes an object or array.
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] !== '}' && text[j] !== ']') out += c;
    } else {
      out += c;
    }
  }
  return JSON.parse(out);
}

const [appDir, outputFile, ...names] = process.argv.slice(2);
if (!appDir || !outputFile || names.length === 0) {
  console.error('Usage: node worker-secrets-file.mjs <app-dir> <output-file> <NAME...>');
  process.exit(1);
}

/** Reads the local defaults from wrangler.toml's [env.local.vars] table (for apps not on wrangler.jsonc). */
function tomlLocalDefaults(text) {
  const defaults = {};
  let inSection = false;
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) {
      inSection = trimmed === '[env.local.vars]';
      continue;
    }
    if (!inSection) continue;
    const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*"([^"]*)"$/) ?? trimmed.match(/^([A-Z0-9_]+)\s*=\s*'([^']*)'$/);
    if (match) defaults[match[1]] = match[2];
  }
  return defaults;
}

let config;
let defaults;
try {
  config = parseJsonc(readFileSync(join(appDir, 'wrangler.jsonc'), 'utf8'));
  defaults = config.env?.local?.vars ?? {};
} catch {
  const toml = readFileSync(join(appDir, 'wrangler.toml'), 'utf8');
  config = { name: toml.match(/^name\s*=\s*"([^"]+)"/m)?.[1] ?? appDir };
  defaults = tomlLocalDefaults(toml);
}

const secrets = {};
const sources = [];
const skipped = [];
for (const name of names) {
  const provided = process.env[name];
  if (provided) {
    secrets[name] = provided;
    sources.push(`${name} (github)`);
  } else if (typeof defaults[name] === 'string' && defaults[name] !== '') {
    secrets[name] = defaults[name];
    sources.push(`${name} (default)`);
  } else {
    skipped.push(name);
  }
}

writeFileSync(outputFile, JSON.stringify(secrets), { mode: 0o600 });
console.log(`Wrote ${sources.length} secret(s) for ${config.name}: ${sources.join(', ') || 'none'}`);
if (skipped.length > 0) console.log(`Skipped (no value and no default): ${skipped.join(', ')}`);
