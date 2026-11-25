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
4. Deploys with `wrangler deploy`. The variables and secrets of the job's
   GitHub environment are bound in that same upload (`--var` and
   `--secrets-file`), so a worker that validates its environment when it
   starts also passes the validation of its very first upload. Then
   `wrangler secret bulk` makes the worker's secrets exactly the ones the
   caller provides (the secrets the caller no longer provides are deleted,
   because a deployment never deletes secrets by itself).

The command parsing and the JSON handling of these steps live in the
`@karasu-lab/workersdeploy` pnpm project in `scripts/`, which `action.yml`
runs with Node.js 24 (it strips the TypeScript types itself, so there is no
build step and nothing to install on the runner).

## Usage

```yaml
jobs:
  deploy:
    environment: ${{ github.ref_name == github.event.repository.default_branch && 'production' || 'preview' }}
    runs-on: ubuntu-latest
    permissions:
      contents: write # the lockfile commit
      packages: read
    env:
      CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
      CLOUDFLARE_ACCOUNT_ID: ${{ vars.CLOUDFLARE_ACCOUNT_ID }}
    steps:
      - uses: Karasu-Lab/WorkersDeploy@v3
        with:
          vars-json: ${{ toJSON(vars) }}
          secrets-json: ${{ toJSON(secrets) }}
```

One job covers both environments. The default branch deploys production and
uses the `production` GitHub environment; every other branch, including a
pull request's, deploys the preview worker and uses the `preview` GitHub
environment. The preview worker is the `dev` environment of `wrangler.jsonc`
(`env.dev`, with its own `name` and domain), which the action selects
through `CLOUDFLARE_ENV` for the build and the deployment.

No names are listed anywhere. Every entry of `vars-json` is bound to the
worker as a variable and every entry of `secrets-json` as a secret (a secret
wins over a variable of the same name). The job's GitHub environment decides
which values those contexts hold, and a value of the environment wins over
one of the repository or the organization, which are the last fallback. So
what differs per environment, such as URLs and the authentication clients,
is set as a variable or a secret of the `production` and `preview`
environments, with the name the worker reads.

These names are never passed: `CLOUDFLARE_*`, `GITHUB_*`, `ACTIONS_*`,
`RUNNER_*`, `NODE_AUTH_TOKEN`, `github_token`, the ones listed in `exclude`,
and the names the wrangler config already defines as vars of the deployed
environment (top-level `vars` in production, `env.<preview-env>.vars` in
preview). An empty value is skipped. Use `exclude` for any other
repository-level value that must not reach the worker.

### Inputs

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `mode` | no | `auto` | `auto` deploys production from the repository's default branch and the preview worker from every other branch; `production` or `preview` forces one |
| `preview-env` | no | `dev` | The wrangler environment of the preview worker, selected through `CLOUDFLARE_ENV` when the mode is preview |
| `exclude` | no | `""` | Space-separated names that must not be passed to the worker |
| `monorepo` | no | `""` | Monorepo (`owner/name`) to assemble the workspace from instead of building the calling repository standalone. It is cloned without submodules; only `app-path` and the paths in `submodules` are initialized, and `app-path` is pinned to the triggering commit |
| `monorepo-branch` | no | `dev` | Monorepo branch cloned for the assembly |
| `app-path` | with `monorepo` | `.` | App directory inside the assembled workspace |
| `submodules` | no | `""` | Space- or newline-separated submodule paths to initialize besides `app-path`; unlisted submodules are never cloned |
| `reset-secrets` | no | `true` | Delete the worker secrets that are not among the secrets passed, so a secret removed from the repository does not stay on the worker. `false` only adds and updates |
| `vars-json` | no | `{}` | Pass `${{ toJSON(vars) }}`; every entry is bound as a variable |
| `secrets-json` | no | `{}` | Pass `${{ toJSON(secrets) }}`; every entry is bound as a secret |
| `node-version` | no | `24` | Node.js version; the scripts of this action need 24 or later |
| `pnpm-version` | no | `12.15.0` | pnpm version, used when the app does not pin one through the `packageManager` field |

### Environment the caller provides

- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for wrangler.
- `packages: read` in the job's `permissions`, so that the job's own
  `GITHUB_TOKEN` can read the `@karasu-lab/*` packages from GitHub
  Packages. The action passes that token to pnpm itself; a
  `NODE_AUTH_TOKEN` is no longer needed in the workflow and a secret of
  that name is not used.
- Any variables the app itself needs at build time (for example
  `NEXT_PUBLIC_*` site keys). The variables resolved from `vars-json` are
  also exported to the build steps.

## Releases

Releases are made by CI (`.github/workflows/release.yml`), never by hand.
Every push to `main` is tagged with the next patch version (`v3.0.N`) and
the floating `v3` tag is moved to the same commit, which is the tag callers
use.

`v3` resolves the mode and the environment by itself, binds the variables
and secrets of the job's GitHub environment in the upload instead of after
it, and no longer takes `secret-names`, `worker-name`, `preview-args` or
`keep-previews`; branch Previews are gone, replaced by a separate preview
worker. A caller moves to `v3` after its `wrangler.jsonc` has an `env.dev`
for the preview worker and its GitHub environments hold the values the
worker reads. The `v1` and `v2` tags stay where they are.
