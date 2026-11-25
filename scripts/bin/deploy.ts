import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { input } from '../src/github.ts';
import { parseObject, stringValues } from '../src/json.ts';

const args = ['exec', 'wrangler', 'deploy'];
if (input('HAS_VARS') === 'true') {
  const vars = stringValues(parseObject(readFileSync(input('VARS_FILE'), 'utf8'), 'the vars file'));
  for (const [name, value] of Object.entries(vars)) {
    args.push('--var', `${name}:${value}`);
  }
}
if (input('HAS_SECRETS') === 'true') {
  args.push('--secrets-file', input('SECRETS_FILE'));
}
execFileSync('pnpm', args, { stdio: 'inherit' });
