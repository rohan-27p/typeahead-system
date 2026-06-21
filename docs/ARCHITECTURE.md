# Architecture

## Components

- Browser UI: debounced search box, suggestion dropdown, keyboard navigation, result display, trending section, cache debug panel.
- Node HTTP API: serves REST endpoints and static frontend files.
- Query normalizer: trims whitespace, collapses multiple spaces, lowercases input.
- SQLite query store: primary data store for `query`, `normalized_query`, and `count`.
- Cache cluster: three logical cache nodes.
- Consistent hash ring: maps suggestion cache keys to cache nodes.
- Trending service: tracks recent search activity in rolling time buckets.
- Batch writer: aggregates repeated search submissions before writing to SQLite.
- Metrics collector: tracks latency, cache hit rate, DB reads/writes, and write reduction.

## Request Flow: Suggestions

1. UI waits for a debounce interval after typing.
2. UI calls `GET /suggest?q=<prefix>`.
3. API normalizes the prefix.
4. API builds a cache key: `suggest:<rankingMode>:<prefix>`.
5. Consistent hash ring chooses the owner cache node.
6. On cache hit, API returns cached suggestions.
7. On cache miss, API queries SQLite, ranks results, stores them in cache with TTL, and returns them.

## Request Flow: Search Submission

1. UI submits `POST /search`.
2. API validates and normalizes the query.
3. API enqueues the query into an in-memory aggregation buffer.
4. API returns `{ "message": "Searched" }`.
5. Batch writer flushes periodically or when the buffer reaches its configured size.
6. Flush upserts query counts into SQLite.
7. Flush records recent activity for trending.
8. Flush invalidates affected prefix cache keys.

## Consistent Hashing

The app creates logical cache nodes:

```text
cache-node-a
cache-node-b
cache-node-c
```

Each node has virtual nodes on a hash ring. A cache key such as:

```text
suggest:trending:iph
```

is hashed and assigned to the first virtual node clockwise on the ring.

This demonstrates distributed cache ownership. If a node is added or removed, only part of the keyspace moves instead of remapping every prefix.

## Trending Ranking

Historical count alone is stable but misses fresh spikes. Trending mode combines:

- historical popularity: `log10(all_time_count + 1)`
- recent activity: decayed count from a rolling time window

The implementation score is:

```text
score = log10(all_time_count + 1) * 100 + recent_count * 25
```

Recent activity decays as buckets age, so a query that was briefly popular does not stay over-ranked forever.

## Batch Writes

The batch writer uses:

```text
Map<query, delta_count>
```

Repeated searches are aggregated:

```text
java spring boot -> +50
react hooks -> +20
```

Instead of 70 database writes, the flush performs 2 upserts.

Trade-off: until flush, counts are eventually consistent. If the process crashes before flushing, in-memory updates can be lost. A production design would use a durable queue or write-ahead log before acknowledging the search.
