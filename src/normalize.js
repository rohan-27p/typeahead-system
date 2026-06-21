export function normalizeQuery(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function isValidQuery(value) {
  return normalizeQuery(value).length > 0;
}

export function prefixUpperBound(prefix) {
  if (!prefix) return '';
  const chars = [...prefix];
  const last = chars.pop();
  if (!last) return prefix;
  const next = String.fromCodePoint(last.codePointAt(0) + 1);
  return `${chars.join('')}${next}`;
}

export function prefixesForQuery(query, maxLength = 20) {
  const normalized = normalizeQuery(query);
  const limit = Math.min(normalized.length, maxLength);
  const prefixes = [];
  for (let i = 1; i <= limit; i += 1) {
    prefixes.push(normalized.slice(0, i));
  }
  return prefixes;
}
