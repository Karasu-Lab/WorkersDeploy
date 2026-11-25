import { execFileSync } from 'node:child_process';
import { input } from '../src/github.ts';
import { expandPreviewArgs } from '../src/preview-args.ts';

const branch = input('BRANCH');
const args = ['exec', 'wrangler', 'preview', '--name', branch];
if (input('HAS_SECRETS') === 'true') {
  args.push('--secrets-file', input('SECRETS_FILE'));
}
args.push(...expandPreviewArgs(input('PREVIEW_ARGS'), branch));
execFileSync('pnpm', args, { stdio: 'inherit' });
