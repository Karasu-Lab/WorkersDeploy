#!/usr/bin/env node
/**
 * Keeps only the newest N Previews of a worker and deletes the rest.
 *
 * Primary source: the Cloudflare API preview collection of the worker,
 * ordered by creation time. When the collection cannot be listed, it
 * falls back to the app repository's branches ordered by last commit
 * date, assuming previews are named after branches.
 *
 * Environment:
 *   CLOUDFLARE_API_TOKEN   (required)
 *   CLOUDFLARE_ACCOUNT_ID  (required)
 *   WORKER_NAME            (required) worker whose previews are pruned
 *   KEEP                   previews to keep (default 5)
 *   CURRENT_BRANCH         branch whose preview is never deleted
 *   PRODUCTION_BRANCH      branch excluded in the fallback (default main)
 *   APP_DIR                app repository checkout for the fallback
 *   CF_API_BASE            API base override (testing)
 *
 * Pruning is housekeeping: failures are reported as warnings and never
 * fail the calling deployment.
 */
import { execFileSync } from "node:child_process";

const token = process.env.CLOUDFLARE_API_TOKEN;
const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const worker = process.env.WORKER_NAME;
const keep = Number.parseInt(process.env.KEEP ?? "5", 10);
const currentBranch = process.env.CURRENT_BRANCH ?? "";
const productionBranch = process.env.PRODUCTION_BRANCH ?? "main";
const appDir = process.env.APP_DIR ?? "";
const base = process.env.CF_API_BASE ?? "https://api.cloudflare.com/client/v4";

function warn(message) {
  console.log(`::warning::prune-previews: ${message}`);
}

async function cf(path, init = {}) {
  const res = await fetch(`${base}/accounts/${account}/workers/workers/${worker}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  return res;
}

async function deletePreview(identifier) {
  const res = await cf(`/previews/${encodeURIComponent(identifier)}`, { method: "DELETE" });
  if (res.ok || res.status === 404) {
    console.log(`deleted preview: ${identifier}`);
    return true;
  }
  warn(`could not delete preview ${identifier} (HTTP ${res.status})`);
  return false;
}

async function pruneFromApi() {
  const res = await cf("/previews");
  if (!res.ok) throw new Error(`list previews failed (HTTP ${res.status})`);
  const body = await res.json();
  const previews = Array.isArray(body) ? body : body.result;
  if (!Array.isArray(previews)) throw new Error("preview list has an unexpected shape");
  const items = previews
    .map((p) => ({
      id: p.name ?? p.id,
      time: Date.parse(p.created_on ?? p.modified_on ?? "") || 0,
    }))
    .filter((p) => p.id);
  items.sort((a, b) => b.time - a.time);
  const keepSet = new Set(items.slice(0, keep).map((p) => p.id));
  if (currentBranch) {
    keepSet.add(currentBranch);
    keepSet.add(currentBranch.replace(/[^a-zA-Z0-9-]/g, "-"));
  }
  const stale = items.filter((p) => !keepSet.has(p.id));
  console.log(`previews: ${items.length}, keeping ${items.length - stale.length}, deleting ${stale.length}`);
  for (const p of stale) await deletePreview(p.id);
}

function pruneFromGit() {
  if (!appDir) throw new Error("no app directory for the git fallback");
  execFileSync("git", ["-C", appDir, "fetch", "origin", "+refs/heads/*:refs/remotes/prune/*"], {
    stdio: "inherit",
  });
  const out = execFileSync(
    "git",
    [
      "-C",
      appDir,
      "for-each-ref",
      "--sort=-committerdate",
      "--format=%(refname:strip=3)",
      "refs/remotes/prune",
    ],
    { encoding: "utf8" },
  );
  const branches = out
    .split("\n")
    .map((b) => b.trim())
    .filter((b) => b && b !== "HEAD" && b !== productionBranch);
  const keepSet = new Set(branches.slice(0, keep));
  if (currentBranch) {
    keepSet.add(currentBranch);
    keepSet.add(currentBranch.replace(/[^a-zA-Z0-9-]/g, "-"));
  }
  const stale = branches.filter((b) => !keepSet.has(b));
  console.log(`branches: ${branches.length}, keeping ${branches.length - stale.length}, deleting ${stale.length} previews`);
  return stale;
}

async function main() {
  if (!token || !account || !worker) {
    warn("CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID and WORKER_NAME are required; skipping");
    return;
  }
  try {
    await pruneFromApi();
    return;
  } catch (error) {
    warn(`API listing unavailable (${error.message}); falling back to git branches`);
  }
  try {
    const stale = pruneFromGit();
    for (const branch of stale) {
      await deletePreview(branch.replace(/[^a-zA-Z0-9-]/g, "-"));
    }
  } catch (error) {
    warn(`git fallback failed (${error.message}); nothing pruned`);
  }
}

await main();
