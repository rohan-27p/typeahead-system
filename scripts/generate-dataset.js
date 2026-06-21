import { createWriteStream, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const dataDir = join(rootDir, 'data');
const outPath = join(dataDir, 'generated_queries.csv');
const targetRows = Number(process.env.DATASET_ROWS || 120000);

mkdirSync(dataDir, { recursive: true });

const heads = [
  'iphone', 'android', 'samsung', 'laptop', 'java', 'python', 'react', 'node', 'redis', 'postgres',
  'docker', 'kubernetes', 'system design', 'machine learning', 'data science', 'gaming', 'camera',
  'headphones', 'charger', 'monitor', 'keyboard', 'travel', 'insurance', 'banking', 'recipe',
  'movie', 'music', 'fitness', 'cricket', 'football'
];

const modifiers = [
  'tutorial', 'price', 'review', 'near me', '2026', 'guide', 'course', 'best', 'cheap', 'online',
  'examples', 'interview questions', 'setup', 'download', 'comparison', 'features', 'release date',
  'service center', 'for beginners', 'advanced', 'architecture', 'performance', 'cache', 'api',
  'dashboard', 'template', 'free', 'premium', 'latest', 'top'
];

const tails = [
  'india', 'usa', 'student', 'developer', 'enterprise', 'small business', 'windows', 'mac',
  'linux', 'mobile', 'backend', 'frontend', 'database', 'security', 'cloud', 'local',
  '2025', '2024', '2023', 'pro', 'max', 'mini', 'plus', 'with examples', 'step by step'
];

function countFor(index) {
  const base = Math.floor(1_200_000 / Math.sqrt(index + 10));
  const wave = Math.floor(5000 * Math.sin(index / 13) + 5000);
  return Math.max(1, base + wave);
}

const stream = createWriteStream(outPath, { encoding: 'utf8' });
stream.write('query,count\n');

let row = 0;
outer:
for (const head of heads) {
  for (const modifier of modifiers) {
    for (const tail of tails) {
      for (let variant = 0; variant < 6; variant += 1) {
        const query = `${head} ${modifier} ${tail} ${variant === 0 ? '' : variant}`.trim();
        stream.write(`${query},${countFor(row)}\n`);
        row += 1;
        if (row >= targetRows) break outer;
      }
    }
  }
}

while (row < targetRows) {
  const head = heads[row % heads.length];
  const modifier = modifiers[Math.floor(row / heads.length) % modifiers.length];
  const tail = tails[Math.floor(row / (heads.length * modifiers.length)) % tails.length];
  const query = `${head} ${modifier} ${tail} query ${row}`;
  stream.write(`${query},${countFor(row)}\n`);
  row += 1;
}

stream.end();
stream.on('finish', () => {
  console.log(`Generated ${row} rows at ${outPath}`);
});
