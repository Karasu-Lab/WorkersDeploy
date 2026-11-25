export function parseJsonc(text: string): unknown {
  let output = '';
  let inString = false;
  let index = 0;
  while (index < text.length) {
    const character = text[index] ?? '';
    const next = text[index + 1];
    if (inString) {
      output += character;
      if (character === '\\') {
        output += next ?? '';
        index += 2;
        continue;
      }
      if (character === '"') inString = false;
      index += 1;
      continue;
    }
    if (character === '"') {
      inString = true;
    } else if (character === '/' && next === '/') {
      while (index < text.length && text[index] !== '\n') index += 1;
      continue;
    } else if (character === '/' && next === '*') {
      index += 2;
      while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) index += 1;
      index += 2;
      continue;
    } else if (character === '}' || character === ']') {
      output = output.replace(/,(\s*)$/, '$1');
    }
    output += character;
    index += 1;
  }
  return JSON.parse(output);
}
