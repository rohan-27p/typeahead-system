# Design Trade-Offs

## SQLite Prefix Search vs Trie

SQLite keeps the demo easy to run and inspect. With 100,000 rows, indexed prefix queries plus caching are enough for local latency goals.

A trie or finite-state transducer would be better for very large datasets because prefix traversal is faster and top suggestions can be precomputed per node. The trade-off is more implementation complexity and harder persistence/update logic.

## Logical Cache Cluster vs Redis

The assignment requires distributed cache behavior using consistent hashing. This project models three logical cache nodes inside one Node process, which keeps the demo local and dependency-free.

Production would use Redis or Memcached nodes. The consistent hashing logic would still decide which node owns each prefix key.

## Cache TTL and Invalidation

The cache has a TTL so stale suggestions expire automatically. After a batch flush, the app also invalidates prefixes affected by changed queries.

TTL alone is simple but less fresh. Targeted invalidation is fresher but requires knowing affected prefixes. This project uses both.

## Batch Writes and Consistency

Batch writes reduce write pressure by aggregating repeated queries before writing to SQLite.

The trade-off is eventual consistency. A search response can return before the primary store count has changed. For the assignment demo this is acceptable and documented. In production, a durable queue would reduce the risk of losing buffered updates.

## Trending Freshness

Trending uses rolling recent activity buckets with decay. This improves freshness while preventing short-lived spikes from staying at the top forever.

The trade-off is that frequent trending changes can invalidate cache entries more often. This project limits complexity by using short TTLs and prefix invalidation after batch flush.
