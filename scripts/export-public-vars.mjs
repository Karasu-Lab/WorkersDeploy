// Appends the app's wrangler.jsonc variables for one environment to the
// file named by GITHUB_ENV (and prints them), so a CI build inlines the
// same NEXT_PUBLIC_* values the worker is deployed with. The top-level
// vars are the production environment; any other name reads env.<name>.vars.
// Usage: node scripts/export-public-vars.mjs <production|preview>
// The app is the current working directory (the calling repository's
// checkout), not this script's location.
import fs from 'node:fs';
import path from 'node:path';

const envName = process.argv[2] ?? 'production';
const root = process.cwd();
const jsonc = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf-8');
// wrangler.jsonc is kept comment-free, so only trailing commas need stripping.
const config = JSON.parse(jsonc.replace(/,\s*([}\]])/g, '$1'));
const vars = envName === 'production' ? (config.vars ?? {}) : (config.env?.[envName]?.vars ?? {});
const lines = Object.entries(vars).map(([key, value]) => `${key}=${value}`);
if (process.env.GITHUB_ENV) {
  fs.appendFileSync(process.env.GITHUB_ENV, `${lines.join('\n')}\n`);
}
console.log(lines.join('\n'));
