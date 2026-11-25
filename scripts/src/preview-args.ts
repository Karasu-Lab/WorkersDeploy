export function expandPreviewArgs(previewArgs: string, branch: string): string[] {
  return previewArgs
    .replaceAll('{branch}', branch)
    .split(/\s+/)
    .filter((argument) => argument !== '');
}
