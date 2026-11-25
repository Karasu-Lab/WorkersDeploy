import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportVariable, input, setOutput, warning } from '../src/github.ts';
import { parseJsonc } from '../src/jsonc.ts';
import { parseObject, stringValues } from '../src/json.ts';
import { parseDeclaredNames, resolveWorkerSecrets } from '../src/secrets.ts';
import { deployedVarNames, type DeployMode } from '../src/wrangler.ts';

const envFile = input('ENV_FILE');
const declared = envFile && existsSync(envFile) ? parseDeclaredNames(readFileSync(envFile, 'utf8')) : [];

const mode: DeployMode = input('MODE') === 'preview' ? 'preview' : 'production';
const deployedVars = new Set(
  ['wrangler.jsonc', 'wrangler.json'].filter((file) => existsSync(file)).flatMap((file) => deployedVarNames(parseJsonc(readFileSync(file, 'utf8')), mode))
);

const { resolved, missing } = resolveWorkerSecrets({
  secretNames: input('SECRET_NAMES'),
  declared,
  sources: {
    vars: stringValues(parseObject(input('VARS_JSON', '{}'), 'vars-json')),
    secrets: stringValues(parseObject(input('SECRETS_JSON', '{}'), 'secrets-json')),
    processEnv: process.env,
  },
  isDeployedVar: (name) => deployedVars.has(name),
});

if (missing.length > 0) {
  warning(`No value is set for the secrets: ${missing.join(' ')}; skipping them`);
}
for (const [name, value] of Object.entries(resolved)) {
  exportVariable(name, value);
}

if (Object.keys(resolved).length === 0) {
  setOutput('has-secrets', 'false');
} else {
  const secretsFile = join(input('RUNNER_TEMP'), 'worker-secrets.json');
  writeFileSync(secretsFile, JSON.stringify(resolved), { mode: 0o600 });
  exportVariable('SECRETS_FILE', secretsFile);
  setOutput('has-secrets', 'true');
  console.log(`Worker secrets: ${Object.keys(resolved).join(' ')}`);
}
