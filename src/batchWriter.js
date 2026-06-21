import { prefixesForQuery } from './normalize.js';

export class BatchWriter {
  constructor({
    store,
    trending,
    cache,
    metrics,
    flushIntervalMs = 5000,
    maxBatchSize = 100
  }) {
    this.store = store;
    this.trending = trending;
    this.cache = cache;
    this.metrics = metrics;
    this.flushIntervalMs = flushIntervalMs;
    this.maxBatchSize = maxBatchSize;
    this.buffer = new Map();
    this.timer = null;
  }

  start() {
    if (!this.timer) {
      this.timer = setInterval(() => this.flush(), this.flushIntervalMs);
      this.timer.unref?.();
    }
  }

  enqueue(query) {
    const key = query.trim();
    this.buffer.set(key, (this.buffer.get(key) ?? 0) + 1);
    this.metrics.searchRequests += 1;
    if (this.buffer.size >= this.maxBatchSize) {
      this.flush();
    }
  }

  flush() {
    if (this.buffer.size === 0) return { flushed: 0 };

    const entries = [...this.buffer.entries()];
    this.buffer.clear();

    this.store.upsertBatch(entries);
    this.metrics.batchFlushes += 1;
    this.metrics.batchAggregatedUpdates += entries.length;
    this.metrics.dbWrites += entries.length;

    for (const [query, delta] of entries) {
      this.trending.record(query, delta);
      for (const prefix of prefixesForQuery(query)) {
        this.cache.invalidate(prefix);
      }
    }

    return { flushed: entries.length };
  }

  status() {
    return {
      pendingUniqueQueries: this.buffer.size,
      pendingTotalDelta: [...this.buffer.values()].reduce((sum, value) => sum + value, 0),
      flushIntervalMs: this.flushIntervalMs,
      maxBatchSize: this.maxBatchSize
    };
  }
}
