// Tags are the one human-meaningful label on a card. One normalizer so a tag typed
// in the customizer, stored on the server, and clicked as a filter are all the same
// string. Canonical form: lowercase, no leading '#', words joined by '-'.

export const normalizeTag = (raw) => {
  if (raw == null) return '';
  return String(raw)
    .trim()
    .replace(/^#+/, '')        // drop leading hashes
    .toLowerCase()
    .replace(/\s+/g, '-')       // spaces -> dashes
    .replace(/[^a-z0-9._-]/g, '') // keep url/filename-safe chars only
    .replace(/-+/g, '-')        // collapse repeats
    .replace(/^[-.]+|[-.]+$/g, ''); // no leading/trailing punctuation
};

// Turn free-form input (comma / whitespace / newline separated) into a clean,
// deduped, order-preserving array of tags.
export const parseTags = (input) => {
  if (Array.isArray(input)) {
    return dedupe(input.map(normalizeTag).filter(Boolean));
  }
  if (input == null) return [];
  const parts = String(input).split(/[\s,]+/);
  return dedupe(parts.map(normalizeTag).filter(Boolean));
};

// Display form, e.g. "neon-galaxy" -> "#neon-galaxy"
export const formatTag = (tag) => {
  const t = normalizeTag(tag);
  return t ? `#${t}` : '';
};

const dedupe = (arr) => {
  const seen = new Set();
  const out = [];
  for (const t of arr) {
    if (!seen.has(t)) { seen.add(t); out.push(t); }
  }
  return out;
};

// Coerce any stored value into a safe tag array (handles legacy cards without tags).
export const ensureTags = (value) => (Array.isArray(value) ? parseTags(value) : []);
