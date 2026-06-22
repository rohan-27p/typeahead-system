import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CacheCluster } from './cacheCluster.js';
import { BatchWriter } from './batchWriter.js';
import { Metrics } from './metrics.js';
import { normalizeQuery, isValidQuery } from './normalize.js';
import { QueryStore } from './storage.js';
import { TrendingService } from './trending.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const rootDir = resolve(__dirname, '..');
const publicDir = join(rootDir, 'public');
const dbPath = process.env.DB_PATH || join(rootDir, 'data', 'typeahead.db');
const port = Number(process.env.PORT || 3000);

const metrics = new Metrics();
const store = new QueryStore(dbPath);
const cache = new CacheCluster({ ttlMs: Number(process.env.CACHE_TTL_MS || 60000) });
const trending = new TrendingService();
const batchWriter = new BatchWriter({
  store,
  trending,
  cache,
  metrics,
  flushIntervalMs: Number(process.env.BATCH_FLUSH_MS || 5000),
  maxBatchSize: Number(process.env.BATCH_SIZE || 100)
});
batchWriter.start();

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  res.end(JSON.stringify(payload, null, 2));
}

function parseBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body too large.'));
      }
    });
    req.on('end', () => {
      if (!body) return resolveBody({});
      try {
        resolveBody(JSON.parse(body));
      } catch {
        reject(new Error('Invalid JSON body.'));
      }
    });
  });
}

function formatSuggestion(row) {
  return {
    query: row.query,
    count: row.count,
    recentCount: row.recentCount ?? 0,
    score: row.score ?? row.count
  };
}

function queryStoreForSuggestions(prefix, rankingMode) {
  metrics.dbReads += 1;

  if (rankingMode === 'trending') {
    const historicalCandidates = store.suggestionsByCount(prefix, 100);
    const recentCandidates = store.rowsByNormalizedQueries(trending.recentQueriesForPrefix(prefix, 100));
    const seen = new Map();
    for (const row of [...historicalCandidates, ...recentCandidates]) {
      seen.set(row.normalizedQuery, row);
    }
    return trending.rank([...seen.values()], 10).map(formatSuggestion);
  }

  return store.suggestionsByCount(prefix, 10).map(formatSuggestion);
}

async function handleSuggest(reqUrl, res) {
  const started = performance.now();
  const prefix = normalizeQuery(reqUrl.searchParams.get('q'));
  const rankingMode = reqUrl.searchParams.get('rank') === 'trending' ? 'trending' : 'count';

  if (!prefix) {
    metrics.recordSuggestLatency(performance.now() - started);
    return sendJson(res, 200, {
      prefix,
      rankingMode,
      suggestions: [],
      source: 'empty-input'
    });
  }

  const cached = cache.get(prefix, rankingMode);
  if (cached.hit) {
    metrics.cacheHits += 1;
    metrics.recordSuggestLatency(performance.now() - started);
    return sendJson(res, 200, {
      prefix,
      rankingMode,
      suggestions: cached.value,
      source: 'cache',
      cache: {
        ownerNode: cached.ownerNode,
        hit: true,
        ttlMsRemaining: Math.round(cached.ttlMsRemaining)
      }
    });
  }

  metrics.cacheMisses += 1;
  const suggestions = queryStoreForSuggestions(prefix, rankingMode);
  cache.set(prefix, rankingMode, suggestions);
  metrics.recordSuggestLatency(performance.now() - started);
  return sendJson(res, 200, {
    prefix,
    rankingMode,
    suggestions,
    source: 'store',
    cache: {
      ownerNode: cached.ownerNode,
      hit: false
    }
  });
}

async function handleSearch(req, res) {
  const body = await parseBody(req);
  const query = String(body.query ?? '').trim();
  if (!isValidQuery(query)) {
    return sendJson(res, 400, {
      error: 'query is required'
    });
  }

  batchWriter.enqueue(query);
  return sendJson(res, 202, {
    message: 'Searched',
    query: normalizeQuery(query),
    writeMode: 'batched',
    batch: batchWriter.status()
  });
}

function handleCacheDebug(reqUrl, res) {
  const prefix = normalizeQuery(reqUrl.searchParams.get('prefix'));
  const rankingMode = reqUrl.searchParams.get('rank') === 'trending' ? 'trending' : 'count';
  if (!prefix) {
    return sendJson(res, 400, { error: 'prefix is required' });
  }
  return sendJson(res, 200, cache.debug(prefix, rankingMode));
}

function handleTrending(res) {
  metrics.dbReads += 1;
  const rows = store.topByCount(100);
  return sendJson(res, 200, {
    rankingMode: 'trending',
    searches: trending.rank(rows, 10).map(formatSuggestion)
  });
}

function serveStatic(reqUrl, res) {
  const requestedPath = reqUrl.pathname === '/' ? '/index.html' : reqUrl.pathname;
  const filePath = resolve(publicDir, `.${requestedPath}`);
  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  res.writeHead(200, {
    'content-type': mimeTypes[extname(filePath)] || 'application/octet-stream'
  });
  createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === 'GET' && reqUrl.pathname === '/suggest') {
      return await handleSuggest(reqUrl, res);
    }

    if (req.method === 'POST' && reqUrl.pathname === '/search') {
      return await handleSearch(req, res);
    }

    if (req.method === 'POST' && reqUrl.pathname === '/admin/flush') {
      return sendJson(res, 200, batchWriter.flush());
    }

    if (req.method === 'GET' && reqUrl.pathname === '/cache/debug') {
      return handleCacheDebug(reqUrl, res);
    }

    if (req.method === 'GET' && reqUrl.pathname === '/trending') {
      return handleTrending(res);
    }

    if (req.method === 'GET' && reqUrl.pathname === '/metrics') {
      return sendJson(res, 200, {
        ...metrics.snapshot(),
        rows: store.countRows(),
        batch: batchWriter.status()
      });
    }

    if (req.method === 'GET') {
      return serveStatic(reqUrl, res);
    }

    return sendJson(res, 405, { error: 'Method not allowed' });
  } catch (error) {
    metrics.errors += 1;
    return sendJson(res, 500, {
      error: error.message
    });
  }
});

server.listen(port, () => {
  console.log(`Search Typeahead System running at http://localhost:${port}`);
  console.log(`Database: ${dbPath}`);
  console.log(`Rows loaded: ${store.countRows()}`);
});

process.on('SIGINT', () => {
  batchWriter.flush();
  server.close(() => process.exit(0));
});
