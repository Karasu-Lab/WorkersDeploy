import { readFileSync } from 'node:fs';
import { setOutput } from '../src/github.ts';
import { detectProjectType } from '../src/project-type.ts';

const projectType = detectProjectType(JSON.parse(readFileSync('package.json', 'utf8')));
console.log(`Detected project type: ${projectType}`);
setOutput('project-type', projectType);
