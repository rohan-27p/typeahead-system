# Viva Question Bank

## Core Design

1. What does the typeahead system do?
2. Why do suggestions need low latency?
3. What are the three required APIs?
4. Why is normalization needed?
5. How does the app handle empty input and no matches?

## Data Storage

1. What fields are stored for each query?
2. Why store both `query` and `normalized_query`?
3. What index helps prefix search?
4. Why is SQLite acceptable for this assignment?
5. What would change at 100 million queries?

## Caching

1. What is cached?
2. What is the cache key?
3. What happens on a cache hit?
4. What happens on a cache miss?
5. How does TTL prevent stale data?
6. How does batch flush invalidate cache entries?

## Consistent Hashing

1. What is consistent hashing?
2. Why is it better than `hash(key) % node_count`?
3. What are virtual nodes?
4. How does `/cache/debug` prove routing behavior?
5. What happens when a cache node is added or removed?

## Trending

1. What is the difference between popular and trending?
2. How is recent activity tracked?
3. What scoring formula is used?
4. Why do recent counts decay?
5. How do you avoid permanently over-ranking spikes?

## Batch Writes

1. Why not write to the database for every search?
2. How does the buffer aggregate repeated queries?
3. When does the batch writer flush?
4. What is the failure risk before flush?
5. How would you make it production-safe?
6. How is write reduction calculated?

## UI

1. Why is debouncing used?
2. How does keyboard navigation work?
3. What loading/error states are shown?
4. How does the UI show cache/debug behavior?

## Performance

1. Why report p95 latency?
2. What cache hit rate did you measure?
3. What write reduction did batching achieve?
4. What is the remaining bottleneck?
