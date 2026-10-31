import { readFileSync } from 'node:fs';
const [file, startStr, endStr] = process.argv.slice(2);
const start = Math.max(1, parseInt(startStr || '1', 10));
const end = parseInt(endStr || '0', 10) || Infinity;
const lines = readFileSync(file, 'utf8').split(/\r?\n/);
for (let i = start - 1; i < lines.length && i < end; i++) {
  process.stdout.write(String(i + 1).padStart(4) + '\t' + lines[i] + '\n');
}
