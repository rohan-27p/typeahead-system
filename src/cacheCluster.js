import { ConsistentHashRing } from './hashRing.js';

class CacheNode {
  constructor(id) {
    this.id = id;
    this.entries = new Map();
  }

  get(key) {
    const entry = this.entries.get(key);
    if (!entry) return { hit: false, value: null, ttlMsRemaining: 0 };

    const ttlMsRemaining = entry.expiresAt - Date.now();
    if (ttlMsRemaining <= 0) {
      this.entries.delete(key);
      return { hit: false, value: null, ttlMsRemaining: 0 };
    }

    entry.hitCount += 1;
    return {
      hit: true,
      value: entry.value,
      ttlMsRemaining
    };
  }

  set(key, value, ttlMs) {
    this.entries.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
      createdAt: Date.now(),
      hitCount: 0
    });
  }

  delete(key) {
    return this.entries.delete(key);
  }

  size() {
    return this.entries.size;
  }
}

export class CacheCluster {
  constructor({ nodeIds = ['cache-node-a', 'cache-node-b', 'cache-node-c'], ttlMs = 60000 } = {}) {
    this.nodes = nodeIds.map((id) => new CacheNode(id));
    this.ttlMs = ttlMs;
    this.ring = new ConsistentHashRing(this.nodes);
  }

  key(prefix, rankingMode) {
    return `suggest:${rankingMode}:${prefix}`;
  }

  route(cacheKey) {
    return this.ring.getNode(cacheKey);
  }

  get(prefix, rankingMode) {
    const cacheKey = this.key(prefix, rankingMode);
    const route = this.route(cacheKey);
    const result = route.node.get(cacheKey);
    return {
      ...result,
      cacheKey,
      ownerNode: route.node.id,
      hash: route.hash,
      ringPosition: route.ringPosition
    };
  }

  set(prefix, rankingMode, value) {
    const cacheKey = this.key(prefix, rankingMode);
    const route = this.route(cacheKey);
    route.node.set(cacheKey, value, this.ttlMs);
  }

  invalidate(prefix, rankingModes = ['count', 'trending']) {
    for (const mode of rankingModes) {
      const cacheKey = this.key(prefix, mode);
      const route = this.route(cacheKey);
      route.node.delete(cacheKey);
    }
  }

  debug(prefix, rankingMode) {
    const cacheKey = this.key(prefix, rankingMode);
    const route = this.route(cacheKey);
    const result = route.node.get(cacheKey);
    return {
      prefix,
      rankingMode,
      cacheKey,
      ownerNode: route.node.id,
      hit: result.hit,
      ttlMsRemaining: Math.max(0, Math.round(result.ttlMsRemaining)),
      hash: route.hash,
      ringPosition: route.ringPosition,
      nodes: this.nodes.map((node) => ({
        id: node.id,
        entries: node.size()
      }))
    };
  }
}
