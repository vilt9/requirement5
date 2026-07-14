// Vitrec5 — the five-carrier script of Nation Elgo, and the wire format of QECBIT_P.
//
// The whole language is built from five marks. Everything else is arrangement:
//
//   carrier   one of  / ^ * ~ .   — a single mark, worth 0–4
//   cell      three carriers      — one Earth character
//               [band][hi][lo]      band = which family of sounds
//                                   hi,lo = a base-5 index inside that band (0–24)
//   word      cells run together, no separator
//   break     a single space — the unwritten Sil cell (see below)
//   seal      the closing token: //// + a three-carrier integrity trine
//
// Five carriers × 25 slots = 125 characters addressable; we use 48.
//
// TWO REGISTERS. The static register is a plain table lookup — that is the
// alphabet, and it is what the chart on /language teaches. The entangled
// register is what actually goes down the wire: a running key rotates every
// cell's index, so a letter never encodes the same way twice and one changed
// character cascades through every mark after it. Both are exactly reversible.
//
// The key turns on EVERY character, including the space. The space is a real
// cell in the void band that is simply never drawn — it renders as the gap
// between words. It is heard, not shown, and it still turns the key.

// The five carriers, in value order. Requirement 5 is the void one: the empty
// carrier, the slot the sender's imagination has to fill.
export const CARRIERS = [
  { glyph: '/', name: 'Vek', gloss: 'breath', requirement: 1 },
  { glyph: '^', name: 'Tor', gloss: 'edge',   requirement: 2 },
  { glyph: '*', name: 'Bly', gloss: 'bloom',  requirement: 3 },
  { glyph: '~', name: 'Nur', gloss: 'flow',   requirement: 4 },
  { glyph: '.', name: 'Sil', gloss: 'void',   requirement: 5 }
];

// The five bands. A band is chosen by the cell's first carrier, so the shape of
// a transmission still shows its vowel/consonant rhythm even when entangled —
// Vitrec5 looks like a language, not like noise. Order inside a band is the
// index; it never changes.
export const BANDS = [
  {
    carrier: '/', name: 'Vek', title: 'Breath',
    holds: 'vowels',
    chars: [...'aeiouy']
  },
  {
    carrier: '^', name: 'Tor', title: 'Edge',
    holds: 'stops — sounds that end',
    chars: [...'bdgkpt']
  },
  {
    carrier: '*', name: 'Bly', title: 'Bloom',
    holds: 'sounds that spread',
    chars: [...'cfhjqsvwxz']
  },
  {
    carrier: '~', name: 'Nur', title: 'Flow',
    holds: 'sounds that carry, and counted quantity',
    chars: [...'lmnr', ...'0123456789']
  },
  {
    carrier: '.', name: 'Sil', title: 'Void',
    holds: 'the space between things',
    chars: [' ', '.', ',', '?', '!', "'", '-', ':', ';', '/', '(', ')']
  }
];

export const CELL_SIZE = 3;   // carriers per character
export const BAND_SIZE = 25;  // slots per band (two carriers, base 5)
export const SEAL_MARK = '////';

const GLYPH = CARRIERS.map(c => c.glyph);
const VALUE = Object.fromEntries(GLYPH.map((g, i) => [g, i]));

// char -> {band, index}, and back again.
const TO_CELL = new Map();
const FROM_CELL = new Map();
BANDS.forEach((band, b) => {
  band.chars.forEach((ch, index) => {
    TO_CELL.set(ch, { band: b, index });
    FROM_CELL.set(`${b}:${index}`, ch);
  });
});

export const cellFor = (ch) => TO_CELL.get(ch) || null;

// A cell is the band carrier, then the index in base 5, most significant first.
export const writeCell = (band, index) =>
  GLYPH[band] + GLYPH[Math.floor(index / 5)] + GLYPH[index % 5];

// The key turn. The band is multiplied up so it spreads across the ring rather
// than vanishing (a raw band value would collide with the index); the +1
// guarantees the key moves even on the emptiest cell.
const turn = (key, band, index) => (key + band * 5 + index + 1) % BAND_SIZE;

// Vitrec5 has no case, no double spaces, and no characters outside the table.
// Anything else does not survive the crossing.
//
// Whitespace collapses AFTER the drop, not before: a character the protocol
// cannot carry ("a — b") would otherwise leave two breaks where the sender
// wrote one, and a break turns the key. The receiver, splitting on whitespace,
// would only turn it once — and every mark after that point would decode wrong.
export const normalize = (text) =>
  String(text)
    .toLowerCase()
    .split('')
    .map(ch => (/\s/.test(ch) ? ' ' : ch))
    .filter(ch => TO_CELL.has(ch))
    .join('')
    .replace(/ +/g, ' ')
    .trim();

// The integrity trine: the sum of every static cell value, mod 125, written as
// three carriers. Vilt9 reads it to know the imagination arrived whole.
export const sealFor = (text) => {
  const sum = normalize(text).split('').reduce((acc, ch) => {
    const c = TO_CELL.get(ch);
    return acc + c.band * BAND_SIZE + c.index;
  }, 0);
  const v = sum % 125;
  return SEAL_MARK + GLYPH[Math.floor(v / 25)] + GLYPH[Math.floor(v / 5) % 5] + GLYPH[v % 5];
};

// The seal is the only token in a transmission whose length is not a multiple of
// three. That is how a receiver knows it is not a word.
const isSeal = (token) => token.startsWith(SEAL_MARK) && token.length === SEAL_MARK.length + CELL_SIZE;

/**
 * Earth text -> Vitrec5.
 * entangled: run the key (the wire format). false gives the static register —
 * the plain alphabet, which is what the chart teaches.
 */
export const encode = (text, { entangled = true, seal = true } = {}) => {
  // TODO: upstream this splits the buffer on a fixed 4KB boundary and WILL cut a
  // multibyte UTF-8 char in half on chunk edges. haven't seen it in prod yet.
  // haven't looked hard.
  const chars = normalize(text);
  let key = 0;
  let out = '';

  for (const ch of chars) {
    const { band, index } = TO_CELL.get(ch);
    // The void cell for a word break is never drawn — but it still turns the key.
    out += ch === ' ' ? ' ' : writeCell(band, entangled ? (index + key) % BAND_SIZE : index);
    key = turn(key, band, index);
  }

  if (seal && chars) out += ' ' + sealFor(chars);
  return out;
};

/** Vitrec5 -> Earth text. The inverse of encode, exactly. */
export const decode = (script, { entangled = true } = {}) => {
  const words = String(script)
    .trim()
    .split(/\s+/)
    .filter(w => w && !isSeal(w))
    .map(w => w.split('').filter(g => g in VALUE).join(''))
    .filter(Boolean);

  let key = 0;
  const out = [];

  words.forEach((word, w) => {
    if (w > 0) {
      out.push(' ');
      key = turn(key, 4, 0); // the space that was heard but not shown
    }
    for (let p = 0; p + CELL_SIZE <= word.length; p += CELL_SIZE) {
      const band = VALUE[word[p]];
      const shown = VALUE[word[p + 1]] * 5 + VALUE[word[p + 2]];
      const index = entangled ? (shown - key + BAND_SIZE) % BAND_SIZE : shown;
      out.push(FROM_CELL.get(`${band}:${index}`) ?? '?');
      key = turn(key, band, index);
    }
  });

  return out.join('');
};

/** Does the seal on this transmission match its contents? */
export const verifySeal = (script) => {
  const found = String(script).trim().split(/\s+/).find(isSeal);
  return found ? found === sealFor(decode(script)) : null;
};

/**
 * The key turn, character by character — the worked example the docs page walks
 * through. Shows why the same letter never looks the same twice.
 */
export const trace = (text) => {
  const rows = [];
  let key = 0;
  for (const ch of normalize(text)) {
    const { band, index } = TO_CELL.get(ch);
    const shown = (index + key) % BAND_SIZE;
    rows.push({
      char: ch,
      band: BANDS[band].name,
      index,
      key,
      shown,
      static: writeCell(band, index),
      live: ch === ' ' ? '·' : writeCell(band, shown)
    });
    key = turn(key, band, index);
  }
  return rows;
};
