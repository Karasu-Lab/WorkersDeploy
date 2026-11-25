# WorkersDeploy

A reusable GitHub Action that deploys an app to Cloudflare Workers
**standalone, from the app's own repository** — no workspace is
assembled in Karasu-Lab/Karasu-Lab, and the shared packages come from the published
`@karasu-lab/*` packages on GitHub Packages (Karasu-Lab/npm), pinned by
the app repository's own `pnpm-lock.yaml`.

## Flow

1. Checks out the calling repository.
2. Detects the project type from `package.json` and branches the build:
   - **Next.js** (`next` dependency): exports the public variables from
     `wrangler.jsonc` for the target environment, then builds with
     OpenNext (`opennextjs-cloudflare build`) and populates the OpenNext
     cache (`opennextjs-cloudflare populateCache local`), which places
     prerendered pages into the static assets for apps that use the
     static assets incremental cache and is a no-op for the rest.
   - **ElysiaJS** (`elysia` dependency): builds with Vite (`vite build`).
   - Anything else: runs the app's `build` script if it has one.
3. Keeps the lockfile in step before installing: `pnpm install
   --lockfile-only` runs first and any change is committed back to the
   branch (with rebase-and-retry on push conflicts), then the install
   itself runs with `--frozen-lockfile`.
4. Converges on the Workers deployment: `wrangler deploy` in
   production, then `wrangler secret bulk` to make the worker's secrets
   exactly the ones the caller provides (the secrets the caller no longer
   provides are deleted, because a deployment never deletes secrets by
   itself), or `wrangler preview` for a branch Preview, and prunes old
   Previews (newest 5 by default).

The command parsing and the JSON handling of these steps live in the
`@karasu-lab/workersdeploy` pnpm project in `scripts/`, which `action.yml`
runs with Node.js 24 (it strips the TypeScript types itself, so there is no
build step and nothing to install on the runner).

## Usage

```yaml
jobs:
  deploy:
    if: github.ref_name == 'main'
    environment: production
    runs-on: ubuntu-latest
    permissions:
      contents: write # the lockfile commit
      packages: read
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
    steps:
      - uses: Karasu-Lab/WorkersDeploy@v2
        with:
          mode: production
          worker-name: example-karasu256-com
          secret-names: INTERNAL_API_SECRET
          vars-json: ${{ toJSON(vars) }}
          secrets-json: ${{ toJSON(secrets) }}
```

Only the names listed in `secret-names` are passed to the worker. The rest
of the caller's contexts is never dumped into the worker, so a repository
or organization secret the app does not read (a registry token, for
example) cannot end up on it, and the action does not read any file of the
app to find the names.

The value of a listed name comes, in this order, from the caller's job
`env` (for example a value mapped from a differently named secret), the
`secrets` context and the `vars` context. The job's GitHub environment
(`production` for a production job, `preview` for a Preview job) decides
which values those contexts hold, and a value of the environment wins over
one of the repository or the organization. So what differs per environment,
such as the database and the authentication clients, is set as a variable
or a secret of the `production` and `preview` environments.

A name is not passed when the wrangler config defines it as a var for the
environment being deployed: `vars` for production, `previews.vars` and
`env.preview.vars` for a Preview. The vars of other environments, such as
`env.local`, do not count.

A `preview` job is the same with `mode: preview` and the `preview`
environment.

### Inputs

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `mode` | yes | — | `production` deploys; `preview` deploys a branch Preview |
| `worker-name` | yes | — | Worker name; also whose Previews are pruned |
| `monorepo` | no | `""` | Monorepo (`owner/name`) to assemble the workspace from instead of building the calling repository standalone. It is cloned without submodules; only `app-path` and the paths in `submodules` are initialized, and `app-path` is pinned to the triggering commit |
| `monorepo-branch` | no | `dev` | Monorepo branch cloned for the assembly |
| `app-path` | with `monorepo` | `.` | App directory inside the assembled workspace |
| `submodules` | no | `""` | Space- or newline-separated submodule paths to initialize besides `app-path`; unlisted submodules are never cloned |
| `secret-names` | no | `""` | Space-separated names of the variables and secrets to pass to the worker. A name with no value is skipped with a warning, and a name the wrangler config defines as a var for the deployed environment is left out |
| `reset-secrets` | no | `true` | In production, delete the worker secrets that are not in `secret-names`, so a variable or secret removed from the repository does not stay on the worker. `false` only adds and updates |
| `vars-json` | no | `{}` | Pass `${{ toJSON(vars) }}`; the job's GitHub environment decides which values it holds |
| `secrets-json` | no | `{}` | Pass `${{ toJSON(secrets) }}`; the job's GitHub environment decides which values it holds |
| `preview-args` | no | `""` | Extra arguments for the Preview command; `{branch}` is substituted |
| `node-version` | no | `24` | Node.js version; the scripts of this action need 24 or later |
| `pnpm-version` | no | `12.15.0` | pnpm version, used when the app does not pin one through the `packageManager` field |
| `keep-previews` | no | `5` | How many of the newest Previews to keep |

### Environment the caller provides

- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for wrangler.
- `packages: read` in the job's `permissions`, so that the job's own
  `GITHUB_TOKEN` can read the `@karasu-lab/*` packages from GitHub
  Packages. The action passes that token to pnpm itself; a
  `NODE_AUTH_TOKEN` is no longer needed in the workflow and a secret of
  that name is not used.
- Any variables the app itself needs at build or run time (for example
  `NEXT_PUBLIC_*` site keys, or the values behind `secret-names`).

## Releases

Releases are made by CI (`.github/workflows/release.yml`), never by hand.
Every push to `main` is tagged with the next patch version (`v2.0.N`) and
the floating `v2` tag is moved to the same commit, which is the tag callers
use.

`v2` passes only the names listed in `secret-names` to the worker, where `v1`
passed every name of the caller's contexts and the names of the app's
`.env.example`. A caller moves to `v2` after its workflow lists every name
its worker reads. The `v1` tag stays where it is.
