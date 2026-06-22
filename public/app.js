const input = document.querySelector('#searchInput');
const form = document.querySelector('#searchForm');
const suggestionsEl = document.querySelector('#suggestions');
const requestState = document.querySelector('#requestState');
const resultBar = document.querySelector('#resultBar');
const trendingList = document.querySelector('#trendingList');
const refreshTrending = document.querySelector('#refreshTrending');
const debugButton = document.querySelector('#debugButton');
const debugBox = document.querySelector('#debugBox');
const systemStatus = document.querySelector('#systemStatus');

let debounceTimer = null;
let activeIndex = -1;
let currentSuggestions = [];
let lastPrefix = '';

function rankingMode() {
  return new FormData(form).get('rankMode') || 'trending';
}

function setState(message) {
  requestState.textContent = message;
}

function renderSuggestions(items) {
  currentSuggestions = items;
  activeIndex = -1;
  suggestionsEl.innerHTML = '';

  if (items.length === 0) {
    suggestionsEl.classList.remove('open');
    return;
  }

  for (const item of items) {
    const li = document.createElement('li');
    li.setAttribute('role', 'option');
    li.innerHTML = `
      <span class="suggestion-query"></span>
      <span class="suggestion-meta"></span>
    `;
    li.querySelector('.suggestion-query').textContent = item.query;
    li.querySelector('.suggestion-meta').textContent = `count ${item.count.toLocaleString()} | score ${item.score}`;
    li.addEventListener('mousedown', (event) => {
      event.preventDefault();
      chooseSuggestion(item.query);
    });
    suggestionsEl.append(li);
  }

  suggestionsEl.classList.add('open');
}

function closeSuggestions({ blur = false } = {}) {
  clearTimeout(debounceTimer);
  renderSuggestions([]);
  if (blur) input.blur();
}

function updateActive() {
  [...suggestionsEl.children].forEach((child, index) => {
    child.classList.toggle('active', index === activeIndex);
    child.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
  });
}

async function fetchSuggestions() {
  const prefix = input.value.trim();
  lastPrefix = prefix;

  if (!prefix) {
    renderSuggestions([]);
    setState('Type to fetch suggestions');
    return;
  }

  setState('Loading suggestions...');
  try {
    const response = await fetch(`/suggest?q=${encodeURIComponent(prefix)}&rank=${rankingMode()}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Suggestion request failed.');
    renderSuggestions(data.suggestions);
    const cacheText = data.cache ? `${data.cache.hit ? 'cache hit' : 'cache miss'} on ${data.cache.ownerNode}` : data.source;
    setState(`${data.suggestions.length} suggestions | ${cacheText}`);
  } catch (error) {
    renderSuggestions([]);
    setState(error.message);
  }
}

function scheduleSuggest() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(fetchSuggestions, 280);
}

async function submitSearch(query) {
  const clean = query.trim();
  if (!clean) return;

  resultBar.className = 'result-bar';
  resultBar.textContent = 'Submitting search...';
  try {
    const response = await fetch('/search', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query: clean })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search failed.');
    resultBar.className = 'result-bar ok';
    resultBar.textContent = `${data.message}: "${data.query}" queued for batched count update.`;
    renderSuggestions([]);
    await fetch('/admin/flush', { method: 'POST' });
    await Promise.all([fetchSuggestions(), loadTrending(), loadMetrics()]);
  } catch (error) {
    resultBar.className = 'result-bar error';
    resultBar.textContent = error.message;
  }
}

function chooseSuggestion(query) {
  input.value = query;
  renderSuggestions([]);
  submitSearch(query);
}

async function loadTrending() {
  try {
    const response = await fetch('/trending');
    const data = await response.json();
    trendingList.innerHTML = '';
    for (const item of data.searches) {
      const li = document.createElement('li');
      li.innerHTML = '<strong></strong><span></span>';
      li.querySelector('strong').textContent = item.query;
      li.querySelector('span').textContent = `count ${item.count.toLocaleString()} | recent ${item.recentCount} | score ${item.score}`;
      trendingList.append(li);
    }
  } catch {
    trendingList.innerHTML = '<li>Unable to load trending searches.</li>';
  }
}

async function loadDebug() {
  const prefix = (input.value.trim() || lastPrefix || 'iph').slice(0, 20);
  try {
    const response = await fetch(`/cache/debug?prefix=${encodeURIComponent(prefix)}&rank=${rankingMode()}`);
    const data = await response.json();
    debugBox.textContent = JSON.stringify(data, null, 2);
  } catch (error) {
    debugBox.textContent = error.message;
  }
}

async function loadMetrics() {
  try {
    const response = await fetch('/metrics');
    const data = await response.json();
    systemStatus.textContent = `${data.rows.toLocaleString()} rows | p95 ${data.p95SuggestMs}ms | cache ${(data.cacheHitRate * 100).toFixed(1)}% | write reduction ${(data.writeReduction * 100).toFixed(1)}%`;
  } catch {
    systemStatus.textContent = 'Metrics unavailable';
  }
}

input.addEventListener('input', scheduleSuggest);
form.addEventListener('change', fetchSuggestions);
form.addEventListener('submit', (event) => {
  event.preventDefault();
  submitSearch(input.value);
});

input.addEventListener('keydown', (event) => {
  if (!suggestionsEl.classList.contains('open')) return;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    activeIndex = Math.min(activeIndex + 1, currentSuggestions.length - 1);
    updateActive();
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    activeIndex = Math.max(activeIndex - 1, 0);
    updateActive();
  }

  if (event.key === 'Enter' && activeIndex >= 0) {
    event.preventDefault();
    chooseSuggestion(currentSuggestions[activeIndex].query);
  }

  if (event.key === 'Escape') {
    closeSuggestions({ blur: true });
  }
});

document.addEventListener('pointerdown', (event) => {
  if (form.contains(event.target)) return;
  closeSuggestions({ blur: true });
});

refreshTrending.addEventListener('click', loadTrending);
debugButton.addEventListener('click', loadDebug);

loadTrending();
loadMetrics();
setInterval(loadMetrics, 5000);
