import { randomBytes } from 'node:crypto';
import { appendFileSync } from 'node:fs';

export function input(name: string, fallback = ''): string {
  return process.env[name] ?? fallback;
}

function appendToFile(variable: 'GITHUB_OUTPUT' | 'GITHUB_ENV', name: string, value: string): void {
  const file = process.env[variable];
  if (!file) {
    throw new Error(`${variable} is not set`);
  }
  const delimiter = `WD_${randomBytes(16).toString('hex')}`;
  appendFileSync(file, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
}

export function setOutput(name: string, value: string): void {
  appendToFile('GITHUB_OUTPUT', name, value);
}

export function exportVariable(name: string, value: string): void {
  appendToFile('GITHUB_ENV', name, value);
}

export function warning(message: string): void {
  console.log(`::warning::${message}`);
}
