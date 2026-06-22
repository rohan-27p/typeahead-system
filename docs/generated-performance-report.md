# Generated Performance Report

Generated at: 2026-06-22T05:47:02.005Z

## Dataset

- Rows loaded: 120005

## Suggest Latency

| Scenario | Requests | p50 ms | p95 ms |
|---|---:|---:|---:|
| Cold-ish cache | 100 | 0.52 | 23.79 |
| Warm cache | 300 | 0.44 | 0.76 |

## Cache

- Cache hit rate: 97.50%
- Cache hits: 390
- Cache misses: 10
- Example owner for prefix "java": cache-node-a

## Batch Writes

- Search requests: 200
- Database writes after aggregation: 2
- Write reduction: 99.00%
- Batch flushes: 1

## Notes

The benchmark intentionally repeats prefixes and search queries to show warm-cache behavior and batch aggregation.
