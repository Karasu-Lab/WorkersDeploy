import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { resolveMode } from '../src/environment.ts';
import { exportVariable, input, setOutput } from '../src/github.ts';
import { parseJsonc } from '../src/jsonc.ts';
import { parseObject, stringValues } from '../src/json.ts';
import { resolveWorkerEnvironment } from '../src/secrets.ts';
import { deployedVarNames } from '../src/wrangler.ts';

const mode = resolveMode(input('MODE'), input('REF_NAME'), input('DEFAULT_BRANCH'));
const envName = mode === 'preview' ? input('PREVIEW_ENV', 'dev') : '';

const deployedVars = new Set(
  ['wrangler.jsonc', 'wrangler.json'].filter((file) => existsSync(file)).flatMap((file) => deployedVarNames(parseJsonc(readFileSync(file, 'utf8')), envName))
);

const { vars, secrets } = resolveWorkerEnvironment({
  vars: stringValues(parseObject(input('VARS_JSON', '{}'), 'vars-json')),
  secrets: stringValues(parseObject(input('SECRETS_JSON', '{}'), 'secrets-json')),
  exclude: input('EXCLUDE'),
  isDeployedVar: (name) => deployedVars.has(name),
});

setOutput('mode', mode);
setOutput('wrangler-env', envName);
if (envName !== '') {
  exportVariable('CLOUDFLARE_ENV', envName);
}
console.log(`Deploying in ${mode} mode${envName === '' ? '' : ` with the wrangler environment "${envName}"`}`);

for (const [name, value] of Object.entries(vars)) {
  exportVariable(name, value);
}

const tempDirectory = input('RUNNER_TEMP');
if (Object.keys(vars).length > 0) {
  const varsFile = join(tempDirectory, 'worker-vars.json');
  writeFileSync(varsFile, JSON.stringify(vars), { mode: 0o600 });
  exportVariable('VARS_FILE', varsFile);
  console.log(`Worker variables: ${Object.keys(vars).join(' ')}`);
}
setOutput('has-vars', String(Object.keys(vars).length > 0));

if (Object.keys(secrets).length > 0) {
  const secretsFile = join(tempDirectory, 'worker-secrets.json');
  writeFileSync(secretsFile, JSON.stringify(secrets), { mode: 0o600 });
  exportVariable('SECRETS_FILE', secretsFile);
  console.log(`Worker secrets: ${Object.keys(secrets).join(' ')}`);
}
setOutput('has-secrets', String(Object.keys(secrets).length > 0));
