import fs from 'fs';
import os from 'os';
import path from 'path';
import sharp from 'sharp';

// Point uploads at a throwaway dir BEFORE the storage module is imported (it reads
// the dir + S3 config at load time). No S3_BUCKET set ⇒ the local driver is used.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'r5c-uploads-'));
process.env.R5C_UPLOADS_DIR = TMP;
delete process.env.S3_BUCKET;

let storage;
let PNG;      // a valid small PNG data URL
let BIG_PNG;  // a 2000x1500 PNG data URL (to exercise downscaling)

const toDataUrl = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

beforeAll(async () => {
  storage = await import('../storage/index.js');
  const small = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 200, g: 40, b: 40 } } })
    .png().toBuffer();
  PNG = toDataUrl(small);
  const big = await sharp({ create: { width: 2000, height: 1500, channels: 3, background: { r: 20, g: 120, b: 200 } } })
    .png().toBuffer();
  BIG_PNG = toDataUrl(big);
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

describe('local image storage', () => {
  test('storeDataUrl normalizes to WebP, writes a file, returns a local /uploads URL', async () => {
    const result = await storage.storeDataUrl(PNG, 'hero');
    expect(result.driver).toBe('local');
    // Uploaded rasters are re-encoded to WebP, so the stored key ends in .webp.
    expect(result.url).toMatch(/^\/uploads\/card-images\/hero_[0-9a-f]{16}\.webp$/);
    const onDisk = path.join(TMP, result.key);
    expect(fs.existsSync(onDisk)).toBe(true);
    // The file really is WebP (RIFF....WEBP magic bytes).
    const bytes = fs.readFileSync(onDisk);
    expect(bytes.slice(0, 4).toString('ascii')).toBe('RIFF');
    expect(bytes.slice(8, 12).toString('ascii')).toBe('WEBP');
  });

  test('oversized images are downscaled to fit within the max dimension', async () => {
    const result = await storage.storeDataUrl(BIG_PNG, 'big');
    const meta = await sharp(fs.readFileSync(path.join(TMP, result.key))).metadata();
    expect(meta.format).toBe('webp');
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(1200);
    // aspect ratio preserved (2000x1500 -> 1200x900)
    expect(meta.width).toBe(1200);
    expect(meta.height).toBe(900);
  });

  test('storeDataUrl returns null for non-image data', async () => {
    expect(await storage.storeDataUrl('not-a-data-url', 'x')).toBeNull();
  });

  test('identical bytes hash to the same key (dedupe)', async () => {
    const a = await storage.storeDataUrl(PNG, 'same');
    const b = await storage.storeDataUrl(PNG, 'same');
    expect(a.key).toBe(b.key);
  });

  test('storageInfo reports the local driver and uploads dir', () => {
    const info = storage.storageInfo();
    expect(info.driver).toBe('local');
    expect(info.bucket).toBeNull();
    expect(info.uploadsDir).toBe(TMP);
  });
});

describe('offloadImages', () => {
  test('replaces embedded data URLs in a nested tree, leaving other values intact', async () => {
    const state = {
      customCard: {
        rarity: 0.5,
        customImageUrl: PNG,
        nested: { holo: PNG, label: 'keep me' },
        list: ['plain', PNG],
      },
    };
    const { value, stored } = await storage.offloadImages(state, 'card');

    // every data URL got replaced with a stored URL
    expect(value.customCard.customImageUrl).toMatch(/^\/uploads\//);
    expect(value.customCard.nested.holo).toMatch(/^\/uploads\//);
    expect(value.customCard.list[1]).toMatch(/^\/uploads\//);
    // non-image values untouched
    expect(value.customCard.rarity).toBe(0.5);
    expect(value.customCard.nested.label).toBe('keep me');
    expect(value.customCard.list[0]).toBe('plain');
    // stored manifest records each offloaded image with its path
    expect(stored.length).toBe(3);
    expect(stored.map(s => s.path).sort()).toEqual([
      'customCard.customImageUrl',
      'customCard.list[1]',
      'customCard.nested.holo',
    ]);
  });
});
