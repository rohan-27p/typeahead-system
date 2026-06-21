import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const port = Number(process.env.PORT || 3100);
const baseUrl = `http://localhost:${port}`;

function wait(ms) {
  return new Promise((resolveWait) => setTimeout(resolveWait, ms));
}

async function waitForServer() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`${baseUrl}/metrics`);
      if (res.ok) return;
    } catch {
      await wait(250);
    }
  }
  throw new Error('Server did not start.');
}

async function timedGet(path) {
  const started = performance.now();
  const res = await fetch(`${baseUrl}${path}`);
  await res.text();
  return performance.now() - started;
}

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil((p / 100) * sorted.length) - 1] ?? 0;
}

async function main() {
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  try {
    await waitForServer();

    const prefixes = ['i', 'ip', 'iph', 'java', 'react', 'python', 'node', 'system', 'machine', 'docker'];
    const cold = [];
    for (let i = 0; i < 100; i += 1) {
      cold.push(await timedGet(`/suggest?q=${encodeURIComponent(prefixes[i % prefixes.length])}&rank=trending`));
    }

    const warm = [];
    for (let i = 0; i < 300; i += 1) {
      warm.push(await timedGet(`/suggest?q=${encodeURIComponent(prefixes[i % prefixes.length])}&rank=trending`));
    }

    const repeatedQueries = ['java spring boot', 'java spring boot', 'java spring boot', 'react hooks', 'react hooks'];
    for (let i = 0; i < 200; i += 1) {
      await fetch(`${baseUrl}/search`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: repeatedQueries[i % repeatedQueries.length] })
      });
    }
    await fetch(`${baseUrl}/admin/flush`, { method: 'POST' });

    const metrics = await fetch(`${baseUrl}/metrics`).then((res) => res.json());
    const debug = await fetch(`${baseUrl}/cache/debug?prefix=java`).then((res) => res.json());

    const report = `# Generated Performance Report

Generated at: ${new Date().toISOString()}

## Dataset

- Rows loaded: ${metrics.rows}

## Suggest Latency

| Scenario | Requests | p50 ms | p95 ms |
|---|---:|---:|---:|
| Cold-ish cache | ${cold.length} | ${percentile(cold, 50).toFixed(2)} | ${percentile(cold, 95).toFixed(2)} |
| Warm cache | ${warm.length} | ${percentile(warm, 50).toFixed(2)} | ${percentile(warm, 95).toFixed(2)} |

## Cache

- Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(2)}%
- Cache hits: ${metrics.cacheHits}
- Cache misses: ${metrics.cacheMisses}
- Example owner for prefix "java": ${debug.ownerNode}

## Batch Writes

- Search requests: ${metrics.searchRequests}
- Database writes after aggregation: ${metrics.dbWrites}
- Write reduction: ${(metrics.writeReduction * 100).toFixed(2)}%
- Batch flushes: ${metrics.batchFlushes}

## Notes

The benchmark intentionally repeats prefixes and search queries to show warm-cache behavior and batch aggregation.
`;

    mkdirSync(join(rootDir, 'docs'), { recursive: true });
    writeFileSync(join(rootDir, 'docs', 'generated-performance-report.md'), report);
    console.log(report);
  } finally {
    child.kill('SIGINT');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
