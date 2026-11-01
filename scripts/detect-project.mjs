#!/usr/bin/env node
/**
 * Detects the project type of the checked-out app from its package.json
 * and reports it as the `project-type` step output:
 *
 * - `nextjs`  when the app depends on Next.js
 * - `elysia`  when the app depends on Elysia
 * - `generic` otherwise (no framework build is assumed)
 */
import { appendFileSync, readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };

const type = 'next' in deps ? 'nextjs' : 'elysia' in deps ? 'elysia' : 'generic';
console.log(`Detected project type: ${type}`);
if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `project-type=${type}\n`);
}
