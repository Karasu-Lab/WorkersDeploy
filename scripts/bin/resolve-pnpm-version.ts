import { existsSync, readFileSync } from 'node:fs';
import { input, setOutput } from '../src/github.ts';
import { pinnedPnpmVersion } from '../src/pnpm-version.ts';

const pinned = existsSync('package.json') ? pinnedPnpmVersion(JSON.parse(readFileSync('package.json', 'utf8'))) : null;
setOutput('version', pinned ?? input('REQUESTED'));
