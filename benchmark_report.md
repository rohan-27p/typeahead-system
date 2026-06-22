# Backend Performance Benchmark

This benchmark validates the assignment-specific performance requirements: low-latency suggestions, cache hit rate, and write reduction through batch writes.

## How To Run

```bash
npm run seed
npm run benchmark
```

The benchmark script starts an isolated server on port `3100`, sends suggestion and search traffic, flushes the batch writer, and writes the generated report to:

```text
docs/generated-performance-report.md
```

## Methodology

- Dataset size: `120,000+` generated query rows.
- Cold-ish read test: repeated requests across several prefixes before cache is fully warm.
- Warm-cache read test: repeated requests after prefix results are cached.
- Batch-write test: repeated `POST /search` submissions with duplicate queries to prove aggregation.
- Cache-routing check: calls `GET /cache/debug?prefix=java` to show the consistent-hash owner node.

## Latest Local Result

| Area | Result |
|---|---:|
| Rows loaded | 120,005 |
| Cold-ish p50 latency | 0.52 ms |
| Cold-ish p95 latency | 23.79 ms |
| Warm-cache p50 latency | 0.44 ms |
| Warm-cache p95 latency | 0.76 ms |
| Cache hit rate | 97.50% |
| Cache hits / misses | 390 / 10 |
| Search requests in batch test | 200 |
| DB writes after aggregation | 2 |
| Write reduction | 99.00% |
| Example cache owner for `java` | cache-node-a |

## Analysis

The warm-cache scenario is faster because repeated prefixes are served from the logical distributed cache instead of SQLite. The consistent hash ring deterministically maps each prefix cache key to one of three logical cache nodes.

The batch-write test submitted 200 searches but produced only 2 database writes after aggregation. That demonstrates the assignment's required write-pressure reduction: repeated queries are collected in a `Map<query, delta>` and flushed as aggregated upserts.
