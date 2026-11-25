import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { input, warning } from '../src/github.ts';
import { parseObject, stringValues } from '../src/json.ts';
import { buildSecretsPayload, parseSecretNames, staleNames, type SecretsPayload } from '../src/sync-secrets.ts';

const kept = input('HAS_SECRETS') === 'true' ? stringValues(parseObject(readFileSync(input('SECRETS_FILE'), 'utf8'), 'the secrets file')) : {};

let payload: SecretsPayload = kept;
if (input('RESET_SECRETS') === 'true') {
  try {
    const listing = execFileSync('pnpm', ['exec', 'wrangler', 'secret', 'list', '--format', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    });
    payload = buildSecretsPayload(kept, parseSecretNames(listing));
    const stale = staleNames(payload);
    if (stale.length > 0) {
      console.log(`Deleting the worker secrets that are no longer provided: ${stale.join(' ')}`);
    }
  } catch (error) {
    warning(`Could not list the worker secrets; only adding and updating them: ${error instanceof Error ? error.message : String(error)}`);
  }
}

if (Object.keys(payload).length > 0) {
  const bulkFile = join(input('RUNNER_TEMP'), 'worker-secrets-sync.json');
  writeFileSync(bulkFile, JSON.stringify(payload), { mode: 0o600 });
  execFileSync('pnpm', ['exec', 'wrangler', 'secret', 'bulk', bulkFile], { stdio: 'inherit' });
}
