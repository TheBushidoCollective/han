const fs = require('node:fs');

const [path, version] = process.argv.slice(2);
if (!path || !/^\d+\.\d+\.\d+$/.test(version || '')) {
  throw new Error('Usage: node update-package-version.cjs <package.json> <major.minor.patch>');
}

const source = fs.readFileSync(path, 'utf8');
const manifest = JSON.parse(source);
if (typeof manifest.version !== 'string') {
  throw new Error('Package version must be a string');
}

// Locate the top-level property without reserializing unrelated fields or formatting.
let depth = 0;
let start = -1;
let end = -1;
for (let i = 0; i < source.length; i++) {
  const char = source[i];
  if (char === '"') {
    const tokenStart = i;
    for (i++; i < source.length; i++) {
      if (source[i] === '\\') i++;
      else if (source[i] === '"') break;
    }
    if (depth !== 1 || JSON.parse(source.slice(tokenStart, i + 1)) !== 'version') continue;
    const rest = source.slice(i + 1);
    const match = /^\s*:\s*("(?:\\.|[^"\\])*")/.exec(rest);
    if (!match) continue;
    start = i + 1 + match[0].length - match[1].length;
    end = start + match[1].length;
    break;
  }
  if (char === '{' || char === '[') depth++;
  if (char === '}' || char === ']') depth--;
}
if (start < 0) throw new Error('Missing top-level version property');
fs.writeFileSync(path, source.slice(0, start) + JSON.stringify(version) + source.slice(end));
