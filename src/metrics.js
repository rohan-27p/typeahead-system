export class Metrics {
  constructor() {
    this.startedAt = new Date();
    this.suggestLatencies = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.dbReads = 0;
    this.dbWrites = 0;
    this.searchRequests = 0;
    this.batchFlushes = 0;
    this.batchAggregatedUpdates = 0;
    this.errors = 0;
  }

  recordSuggestLatency(ms) {
    this.suggestLatencies.push(ms);
    if (this.suggestLatencies.length > 10000) {
      this.suggestLatencies.shift();
    }
  }

  percentile(values, percentile) {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return Number(sorted[Math.max(0, index)].toFixed(2));
  }

  snapshot() {
    const cacheTotal = this.cacheHits + this.cacheMisses;
    const writeReduction = this.searchRequests === 0
      ? 0
      : 1 - this.dbWrites / this.searchRequests;

    return {
      startedAt: this.startedAt.toISOString(),
      uptimeSeconds: Number(((Date.now() - this.startedAt.getTime()) / 1000).toFixed(1)),
      suggestRequests: this.suggestLatencies.length,
      p50SuggestMs: this.percentile(this.suggestLatencies, 50),
      p95SuggestMs: this.percentile(this.suggestLatencies, 95),
      p99SuggestMs: this.percentile(this.suggestLatencies, 99),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate: cacheTotal === 0 ? 0 : Number((this.cacheHits / cacheTotal).toFixed(4)),
      dbReads: this.dbReads,
      dbWrites: this.dbWrites,
      searchRequests: this.searchRequests,
      batchFlushes: this.batchFlushes,
      batchAggregatedUpdates: this.batchAggregatedUpdates,
      writeReduction: Number(writeReduction.toFixed(4)),
      errors: this.errors
    };
  }
}
