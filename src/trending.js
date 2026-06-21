import { normalizeQuery } from './normalize.js';

export class TrendingService {
  constructor({ bucketMs = 5 * 60 * 1000, windowMs = 60 * 60 * 1000 } = {}) {
    this.bucketMs = bucketMs;
    this.windowMs = windowMs;
    this.buckets = new Map();
  }

  bucketStart(now = Date.now()) {
    return Math.floor(now / this.bucketMs) * this.bucketMs;
  }

  record(query, delta = 1, now = Date.now()) {
    const normalized = normalizeQuery(query);
    if (!normalized || delta <= 0) return;
    const start = this.bucketStart(now);
    if (!this.buckets.has(start)) this.buckets.set(start, new Map());
    const bucket = this.buckets.get(start);
    bucket.set(normalized, (bucket.get(normalized) ?? 0) + delta);
    this.prune(now);
  }

  prune(now = Date.now()) {
    const oldest = now - this.windowMs;
    for (const start of this.buckets.keys()) {
      if (start < oldest) this.buckets.delete(start);
    }
  }

  recentCount(normalizedQuery, now = Date.now()) {
    this.prune(now);
    let total = 0;
    for (const [start, bucket] of this.buckets.entries()) {
      const age = now - start;
      if (age <= this.windowMs) {
        const decay = 1 - age / this.windowMs;
        total += (bucket.get(normalizedQuery) ?? 0) * Math.max(0.05, decay);
      }
    }
    return total;
  }

  recentQueriesForPrefix(prefix, limit = 100) {
    this.prune();
    const totals = new Map();
    for (const bucket of this.buckets.values()) {
      for (const [query, count] of bucket.entries()) {
        if (query.startsWith(prefix)) {
          totals.set(query, (totals.get(query) ?? 0) + count);
        }
      }
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([query]) => query);
  }

  score(row) {
    const recent = this.recentCount(row.normalizedQuery);
    const historical = Math.log10(row.count + 1);
    return Number((historical * 100 + recent * 25).toFixed(4));
  }

  rank(rows, limit = 10) {
    return rows
      .map((row) => ({
        ...row,
        recentCount: Number(this.recentCount(row.normalizedQuery).toFixed(2)),
        score: this.score(row)
      }))
      .sort((a, b) => b.score - a.score || b.count - a.count || a.normalizedQuery.localeCompare(b.normalizedQuery))
      .slice(0, limit);
  }
}
