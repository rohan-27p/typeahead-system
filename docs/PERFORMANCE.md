# Performance And Benchmark

Run:

```bash
npm run benchmark
```

The generated report is written to:

```text
docs/generated-performance-report.md
```

The submission-facing benchmark summary is also available at:

```text
benchmark_report.md
```

Include the generated values in the final submission.

## Metrics To Report

- Dataset size.
- p50 suggestion latency.
- p95 suggestion latency.
- Cache hit rate.
- DB reads.
- Search requests.
- DB writes after batching.
- Write reduction percentage.
- Example cache owner from `GET /cache/debug?prefix=java`.

## Write Reduction Formula

```text
write_reduction = 1 - (actual_db_writes / search_requests)
```

Example:

```text
200 search submissions
2 DB writes after aggregation
write reduction = 99%
```
