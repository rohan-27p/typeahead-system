import { readFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { QueryStore } from '../src/storage.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const csvPath = process.env.DATASET_PATH || join(rootDir, 'data', 'generated_queries.csv');
const dbPath = process.env.DB_PATH || join(rootDir, 'data', 'typeahead.db');

if (!existsSync(csvPath)) {
  throw new Error(`Dataset not found: ${csvPath}. Run npm run seed or scripts/generate-dataset.js first.`);
}

for (const suffix of ['', '-shm', '-wal']) {
  const path = `${dbPath}${suffix}`;
  if (existsSync(path)) rmSync(path);
}

const store = new QueryStore(dbPath);
const text = readFileSync(csvPath, 'utf8');
const lines = text.split(/\r?\n/).filter(Boolean);
const rows = [];

for (const line of lines.slice(1)) {
  const comma = line.lastIndexOf(',');
  if (comma <= 0) continue;
  const query = line.slice(0, comma).trim();
  const count = Number(line.slice(comma + 1));
  if (query && Number.isFinite(count)) rows.push([query, count]);
}

for (let i = 0; i < rows.length; i += 1000) {
  store.upsertBatch(rows.slice(i, i + 1000));
}

const total = store.countRows();
console.log(`Loaded ${total} unique queries into ${dbPath}`);
if (total < 100000) {
  throw new Error(`Dataset requirement not met. Need at least 100000 rows; found ${total}.`);
}
