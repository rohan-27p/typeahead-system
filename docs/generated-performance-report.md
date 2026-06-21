# Generated Performance Report

Generated at: 2026-06-21T18:17:23.960Z

## Dataset

- Rows loaded: 120002

## Suggest Latency

| Scenario | Requests | p50 ms | p95 ms |
|---|---:|---:|---:|
| Cold-ish cache | 100 | 0.83 | 5.11 |
| Warm cache | 300 | 0.99 | 2.27 |

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
