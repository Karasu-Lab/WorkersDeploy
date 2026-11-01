# WorkersDeploy

A reusable GitHub Action that deploys an app to Cloudflare Workers
**standalone, from the app's own repository** — no hub workspace is
assembled, and the shared packages come from the published
`@karasu-lab/*` packages on GitHub Packages (Karasu-Lab/npm), pinned by
the app repository's own `pnpm-lock.yaml`.

## Flow

1. Checks out the calling repository.
2. Detects the project type from `package.json` and branches the build:
   - **Next.js** (`next` dependency): exports the public variables from
     `wrangler.jsonc` for the target environment, then builds with
     OpenNext (`opennextjs-cloudflare build`).
   - **Elysia** (`elysia` dependency): builds with Vite (`vite build`).
   - Anything else: runs the app's `build` script if it has one.
3. Keeps the lockfile in step before installing: `pnpm install
   --lockfile-only` runs first and any change is committed back to the
   branch (with rebase-and-retry on push conflicts), then the install
   itself runs with `--frozen-lockfile`.
4. Converges on the Workers deployment: `wrangler deploy` in
   production (plus `wrangler secret bulk` when secrets are configured),
   or `wrangler preview` for a branch Preview, and prunes old Previews
   (newest 5 by default).

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
      NODE_AUTH_TOKEN: ${{ secrets.NODE_AUTH_TOKEN || secrets.GITHUB_TOKEN }}
    steps:
      - uses: Karasu-Lab/WorkersDeploy@v1
        with:
          mode: production
          worker-name: example-karasu256-com
```

A `preview` job is the same with `mode: preview` and the `preview`
environment.

### Inputs

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `mode` | yes | — | `production` deploys; `preview` deploys a branch Preview |
| `worker-name` | yes | — | Worker name; also whose Previews are pruned |
| `secret-names` | no | `""` | Space-separated secret names read from the environment, written to a secrets file for Previews and bulk-synced in production. Unset names fall back to the app's `env.local` vars in its wrangler config |
| `preview-args` | no | `""` | Extra arguments for the Preview command; `{branch}` is substituted |
| `node-version` | no | `24` | Node.js version |
| `pnpm-version` | no | `12.15.0` | pnpm version, used when the app does not pin one through the `packageManager` field |
| `keep-previews` | no | `5` | How many of the newest Previews to keep |

### Environment the caller provides

- `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for wrangler.
- `NODE_AUTH_TOKEN` (the name the Vercel deployments use) so pnpm can
  read the `@karasu-lab/*` packages from GitHub Packages.
- Any variables the app itself needs at build or run time (for example
  `NEXT_PUBLIC_*` site keys, or the values behind `secret-names`).
