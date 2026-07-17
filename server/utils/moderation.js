// Text safety screen for anything a user types that others will see: usernames,
// card names, card info, set labels/blurbs, tags. Two jobs, kept deliberately
// simple and dependency-free so it runs the same on the box and in tests.
//
//   1. Hard slurs / hate terms  → matched against a fully-normalised string with
//      separators and leetspeak stripped, so "n-i-g_g3r" is still caught. These
//      stems are distinctive enough not to collide with innocent words.
//   2. General profanity        → matched at WHOLE-TOKEN level (after the same
//      normalisation), so "class" / "grass" / "Scunthorpe" don't trip the "ass"
//      rule while "you ass" does.
//
// This is a floor, not a guarantee — it stops the obvious stuff at the door and
// pairs with the human review queue (flagged cards) for everything subtler.

// Common leetspeak / lookalike substitutions folded back to letters.
const LEET = {
  '@': 'a', '4': 'a', '8': 'b', '3': 'e', '1': 'i', '!': 'i', '|': 'i',
  '0': 'o', '5': 's', '$': 's', '7': 't', '+': 't', '9': 'g', '2': 'z'
};

// Strip accents, apply leet map, drop everything that isn't a-z/0-9.
const foldChar = (ch) => LEET[ch] ?? ch;

const normalize = (input) =>
  String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // combining accents
    .toLowerCase()
    .split('')
    .map(foldChar)
    .join('')
    .replace(/[^a-z0-9]/g, '');

// Collapse runs of the same character ("fuuuuck" → "fuck") so padded obfuscation
// still matches the dictionary form.
const collapse = (s) => s.replace(/(.)\1{1,}/g, '$1');

// Hard-block stems. Matched as substrings of the fully-normalised string.
// Intentionally minimal and stem-based to catch variants (…s, …er, …ing).
const SLUR_STEMS = [
  'nigg', 'niga', 'faggot', 'fagot', 'retard', 'kike', 'spic', 'chink',
  'gook', 'wetback', 'tranny', 'coon', 'paki', 'beaner', 'raghead',
  'sandnigg', 'nazi', 'kkk', 'heil'
];

// General profanity. Matched against whole normalised tokens (plus their
// repeat-collapsed form), so embedding inside a clean word doesn't trip.
const PROFANITY = new Set([
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch',
  'cunt', 'asshole', 'ass', 'arse', 'arsehole', 'dick', 'dickhead', 'cock',
  'pussy', 'slut', 'whore', 'bastard', 'wank', 'wanker', 'twat', 'bollocks',
  'prick', 'jizz', 'cum', 'blowjob', 'handjob', 'boner', 'dildo', 'porn',
  'porno', 'rape', 'rapist', 'pedo', 'paedo', 'pedophile', 'paedophile',
  'nonce', 'incest', 'bestiality', 'anus', 'testicle', 'nutsack'
]);

// Screen one string. Returns { ok, matches } — matches lists the offending
// term(s) so callers can log/inspect, though the user only sees a generic error.
export const screen = (text) => {
  const flat = normalize(text);
  if (!flat) return { ok: true, matches: [] };
  const flatCollapsed = collapse(flat);
  const matches = new Set();

  for (const stem of SLUR_STEMS) {
    if (flat.includes(stem) || flatCollapsed.includes(stem)) matches.add(stem);
  }

  // Token-level pass for general profanity: re-tokenise the ORIGINAL on any
  // non-alphanumeric run, normalise each token on its own.
  const tokens = String(text || '')
    .split(/[^a-zA-Z0-9@!$|+]+/)
    .map(normalize)
    .filter(Boolean);
  for (const token of tokens) {
    if (PROFANITY.has(token) || PROFANITY.has(collapse(token))) matches.add(token);
  }

  return { ok: matches.size === 0, matches: [...matches] };
};

// Screen a set of named fields ({ 'Card name': value, Tags: [...] }). Returns
// the first field that fails with a ready-made message, or null if all clean.
// Array values (tags) are screened element by element.
export const screenFields = (fields) => {
  for (const [label, value] of Object.entries(fields)) {
    if (value == null) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (typeof v !== 'string') continue;
      if (!screen(v).ok) {
        return { field: label, message: `${label} contains language we don't allow. Please revise it.` };
      }
    }
  }
  return null;
};
