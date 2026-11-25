import { execFileSync } from 'node:child_process';
import { input, warning } from '../src/github.ts';
import { parsePreviews, selectStaleBranches, selectStalePreviews } from '../src/previews.ts';

const token = input('CLOUDFLARE_API_TOKEN');
const accountId = input('CLOUDFLARE_ACCOUNT_ID');
const keep = Number(input('KEEP', '5'));
const currentBranch = input('CURRENT_BRANCH');
const appDir = input('APP_DIR', '.');

async function findStale(api: string): Promise<string[]> {
  try {
    const response = await fetch(api, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return selectStalePreviews(parsePreviews(await response.json()), keep, currentBranch);
  } catch {
    warning('prune-previews: API listing unavailable; falling back to git branches');
  }
  try {
    execFileSync('git', ['-C', appDir, 'fetch', 'origin', '+refs/heads/*:refs/remotes/prune/*'], { stdio: 'inherit' });
    const refs = execFileSync(
      'git',
      ['-C', appDir, 'for-each-ref', '--sort=-committerdate', '--format=%(refname:strip=3)', 'refs/remotes/prune'],
      { encoding: 'utf8' }
    );
    return selectStaleBranches(refs.split('\n').filter((ref) => ref !== ''), keep, currentBranch);
  } catch {
    warning('prune-previews: git fallback failed; nothing pruned');
    return [];
  }
}

if (!token || !accountId) {
  warning('prune-previews: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required; skipping');
} else {
  const api = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/workers/${input('WORKER_NAME')}/previews`;
  for (const id of await findStale(api)) {
    const response = await fetch(`${api}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => null);
    if (response && (response.ok || response.status === 404)) {
      console.log(`deleted preview: ${id}`);
    } else {
      warning(`prune-previews: could not delete preview ${id} (HTTP ${response?.status ?? 'unreachable'})`);
    }
  }
}
