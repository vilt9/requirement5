// A set name is identity-bearing: it's the primary key of the sets table and
// what cards point at, so the SERVER owns the canonical form — never the client.
// (Contrast tags, normalized client-side in src/utils/tags.js.)
//
// Canonical form: `<username>_<label>`, e.g. "alice_deep-sea". Usernames are
// already unique and /^[a-zA-Z0-9_]{3,24}$/, so the namespaced name is unique
// app-wide with no extra uniqueness check.

export const SET_LABEL_MAX = 48;
export const SET_INFO_MAX = 280;

// The typed part of a set name, canonicalized. Mirrors normalizeTag's rules but
// also folds '_' to '-': '_' is the namespace delimiter, so keeping it in the
// label would make `<username>_<label>` ambiguous to read back.
export const normalizeSetLabel = (raw) => {
  if (raw == null) return '';
  return String(raw)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')        // spaces and underscores -> dashes
    .replace(/[^a-z0-9.-]/g, '')    // url/filename-safe chars only
    .replace(/-+/g, '-')            // collapse repeats
    .replace(/^[-.]+|[-.]+$/g, '')  // no leading/trailing punctuation
    .slice(0, SET_LABEL_MAX)
    .replace(/[-.]+$/, '');         // slicing may have left trailing punctuation
};

// Build the stored set id/name from a username + a typed label. Returns null
// when the label normalizes away to nothing (i.e. "no set").
export const setNameFor = (username, rawLabel) => {
  const label = normalizeSetLabel(rawLabel);
  if (!label) return null;
  return `${String(username).toLowerCase()}_${label}`;
};

// The display half of a stored set name — everything after the username prefix.
// Splits on the FIRST delimiter past the username rather than the last, since
// usernames may themselves contain '_'.
export const setLabelOf = (setName, username) => {
  if (!setName) return '';
  const prefix = `${String(username).toLowerCase()}_`;
  return setName.startsWith(prefix) ? setName.slice(prefix.length) : setName;
};

// Free-text blurb attached to a card or a set. Trimmed and length-capped;
// empty becomes null so "unset" and "set to empty" are the same thing.
export const normalizeInfo = (raw, max = SET_INFO_MAX) => {
  if (raw == null) return null;
  const text = String(raw).trim().slice(0, max);
  return text || null;
};
