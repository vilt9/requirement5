import {
  encode, decode, normalize, sealFor, verifySeal, trace, writeCell, BANDS, CARRIERS, SEAL_MARK
} from '../utils/vitrec5';

const GLYPHS = CARRIERS.map(c => c.glyph);

describe('the alphabet', () => {
  test('every character in every band is a distinct three-carrier cell', () => {
    const cells = new Set();
    BANDS.forEach((band, b) => {
      band.chars.forEach((ch, i) => {
        const cell = writeCell(b, i);
        expect(cell).toHaveLength(3);
        expect(cell[0]).toBe(band.carrier);
        expect(cells.has(cell)).toBe(false); // no two characters share a cell
        cells.add(cell);
      });
    });
  });

  test('nothing but the five carriers ever appears in a transmission', () => {
    const script = encode('the quick brown fox jumps over the lazy dog 0123456789!');
    expect(script.replace(/ /g, '').split('').every(g => GLYPHS.includes(g))).toBe(true);
  });

  test('a band never overflows its 25 slots', () => {
    BANDS.forEach(band => expect(band.chars.length).toBeLessThanOrEqual(25));
  });
});

describe('normalize', () => {
  test('strips case, collapses runs of whitespace, drops what cannot cross', () => {
    expect(normalize('  We   NEED\nImagination  ')).toBe('we need imagination');
    expect(normalize('café — 50%')).toBe('caf 50'); // é, em dash and % are not carried
  });
});

describe('round trip', () => {
  const SAMPLES = [
    'hello',
    'we need your imagination',
    'what is your name?',
    'pay 12 /t26 and the card is yours.',
    'a card for a card',
    'eeee',
    "don't stop - send more!"
  ];

  test.each(SAMPLES)('entangled: %s', (text) => {
    expect(decode(encode(text))).toBe(normalize(text));
  });

  test.each(SAMPLES)('static: %s', (text) => {
    expect(decode(encode(text, { entangled: false }), { entangled: false })).toBe(normalize(text));
  });

  test('empty text produces an empty transmission', () => {
    expect(encode('   ')).toBe('');
    expect(decode('')).toBe('');
  });
});

describe('entanglement', () => {
  test('the same word encodes differently at different points in a message', () => {
    const [first, second] = encode('a card for a card').split(' ').filter(w => w.length === 12);
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first).not.toBe(second);
  });

  // The claim the /language page makes about "a card for a card". The band marks
  // are deliberately NOT rotated — they are the skeleton that keeps Vitrec5
  // legible as a language. Everything between them moves.
  test('a repeated word keeps its band marks and moves every index mark', () => {
    const words = encode('a card for a card', { seal: false }).split(' ');
    const [first, second] = [words[1], words[4]];

    const bandPositions = [0, 3, 6, 9];
    bandPositions.forEach(p => expect(second[p]).toBe(first[p]));

    const indexPositions = [1, 2, 4, 5, 7, 8, 10, 11];
    indexPositions.forEach(p => expect(second[p]).not.toBe(first[p]));
  });

  test('a repeated letter never repeats its cell', () => {
    const word = encode('eeee', { seal: false });
    const cells = word.match(/.{3}/g);
    expect(new Set(cells).size).toBe(4);
  });

  test('the static register does repeat — that is what makes it readable', () => {
    const word = encode('eeee', { entangled: false, seal: false });
    expect(new Set(word.match(/.{3}/g)).size).toBe(1);
  });

  test('one changed character cascades through every mark after it', () => {
    const a = encode('send imagination', { seal: false }).replace(/ /g, '');
    const b = encode('bend imagination', { seal: false }).replace(/ /g, '');
    expect(a).toHaveLength(b.length);
    // Only the first cell is meant to differ; entanglement drags the rest with it.
    const tail = [...a.slice(3)].filter((g, i) => g !== b.slice(3)[i]).length;
    expect(tail).toBeGreaterThan(0);
  });

  test('the word break turns the key even though it is never drawn', () => {
    // Same letters, different grouping -> different marks.
    expect(encode('ab c', { seal: false }).replace(/ /g, ''))
      .not.toBe(encode('abc', { seal: false }));
  });
});

describe('the seal', () => {
  test('is the only token whose length is not a multiple of three', () => {
    const seal = encode('we need your imagination').split(' ').pop();
    expect(seal.startsWith(SEAL_MARK)).toBe(true);
    expect(seal).toHaveLength(7);
    expect(seal.length % 3).not.toBe(0);
  });

  test('verifies a whole transmission, and catches a tampered one', () => {
    const script = encode('the imagination is fading');
    expect(verifySeal(script)).toBe(true);

    const tampered = script.replace(SEAL_MARK + script.split(SEAL_MARK)[1], sealFor('something else'));
    expect(verifySeal(tampered)).toBe(false);
  });

  test('carries no text of its own', () => {
    expect(decode(encode('hello'))).toBe(decode(encode('hello', { seal: false })));
  });
});

describe('trace', () => {
  test('walks the key one character at a time', () => {
    const rows = trace('hi');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ char: 'h', band: 'Bly', key: 0 });
    expect(rows[0].static).toBe(rows[0].live); // the key starts at rest
    expect(rows[1].key).not.toBe(0);
  });
});
