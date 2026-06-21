import test from 'node:test';
import assert from 'node:assert/strict';
import { CacheCluster } from '../src/cacheCluster.js';
import { ConsistentHashRing } from '../src/hashRing.js';
import { normalizeQuery, prefixesForQuery } from '../src/normalize.js';
import { TrendingService } from '../src/trending.js';

test('normalizes query text', () => {
  assert.equal(normalizeQuery('  IPhone   Charger  '), 'iphone charger');
});

test('generates bounded prefixes', () => {
  assert.deepEqual(prefixesForQuery('java', 3), ['j', 'ja', 'jav']);
});

test('consistent hash ring returns stable owner for same key', () => {
  const nodes = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const ring = new ConsistentHashRing(nodes, 20);
  const first = ring.getNode('suggest:iph').node.id;
  const second = ring.getNode('suggest:iph').node.id;
  assert.equal(first, second);
});

test('cache cluster stores key on routed owner node', () => {
  const cache = new CacheCluster({ nodeIds: ['a', 'b', 'c'], ttlMs: 1000 });
  cache.set('iph', 'trending', [{ query: 'iphone', count: 100 }]);
  const hit = cache.get('iph', 'trending');
  assert.equal(hit.hit, true);
  assert.equal(hit.value[0].query, 'iphone');
  assert.ok(['a', 'b', 'c'].includes(hit.ownerNode));
});

test('trending rank can lift recent query', () => {
  const trending = new TrendingService();
  trending.record('java spring boot', 20);
  const rows = [
    { query: 'java tutorial', normalizedQuery: 'java tutorial', count: 100000 },
    { query: 'java spring boot', normalizedQuery: 'java spring boot', count: 1000 }
  ];
  const ranked = trending.rank(rows, 2);
  assert.equal(ranked[0].query, 'java spring boot');
});
