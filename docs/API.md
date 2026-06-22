# API Documentation

Base URL:

```text
http://localhost:3000
```

## `GET /suggest?q=<prefix>`

Fetch up to 10 suggestions whose queries start with the prefix.

Query parameters:

- `q`: typed prefix.
- `rank`: optional. Use `count` or `trending`. Defaults to `count` so the bare required endpoint returns count-sorted suggestions.

Example:

```http
GET /suggest?q=iph&rank=trending
```

Response:

```json
{
  "prefix": "iph",
  "rankingMode": "trending",
  "suggestions": [
    {
      "query": "iphone tutorial india",
      "count": 379473,
      "recentCount": 0,
      "score": 557.92
    }
  ],
  "source": "cache",
  "cache": {
    "ownerNode": "cache-node-b",
    "hit": true,
    "ttlMsRemaining": 59842
  }
}
```

Behavior:

- Empty or missing prefix returns an empty list.
- Mixed-case input is normalized.
- No matches returns an empty list.
- Results are capped at 10.
- `rank=count` sorts by all-time count.
- `rank=trending` sorts by recency-aware score for the enhanced version.

## `POST /search`

Submit a search query and queue its count update for batch writing.

Request:

```json
{
  "query": "java spring boot"
}
```

Response:

```json
{
  "message": "Searched",
  "query": "java spring boot",
  "writeMode": "batched",
  "batch": {
    "pendingUniqueQueries": 1,
    "pendingTotalDelta": 1,
    "flushIntervalMs": 5000,
    "maxBatchSize": 100
  }
}
```

Behavior:

- Existing query count is incremented during batch flush.
- New query is inserted during batch flush.
- The update is eventually reflected in suggestions and trending.

## `GET /cache/debug?prefix=<prefix>`

Show consistent-hash routing for a prefix.

Example:

```http
GET /cache/debug?prefix=java
```

Response:

```json
{
  "prefix": "java",
  "rankingMode": "trending",
  "cacheKey": "suggest:trending:java",
  "ownerNode": "cache-node-a",
  "hit": true,
  "ttlMsRemaining": 44125,
  "hash": 123456789,
  "ringPosition": 124000000,
  "nodes": [
    { "id": "cache-node-a", "entries": 3 },
    { "id": "cache-node-b", "entries": 4 },
    { "id": "cache-node-c", "entries": 2 }
  ]
}
```

## `GET /trending`

Return top trending searches for the UI.

## `GET /metrics`

Return runtime metrics:

- p50/p95/p99 suggest latency.
- cache hits/misses and hit rate.
- DB reads/writes.
- search requests.
- batch flushes.
- write-reduction ratio.
- loaded row count.

## `POST /admin/flush`

Force the batch writer to flush immediately. This is useful for demos and tests.
