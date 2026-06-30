import fs from 'fs';
import os from 'os';
import path from 'path';

// Point uploads at a throwaway dir BEFORE the storage module is imported (it reads
// the dir + S3 config at load time). No S3_BUCKET set ⇒ the local driver is used.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'r5c-uploads-'));
process.env.R5C_UPLOADS_DIR = TMP;
delete process.env.S3_BUCKET;

let storage;
beforeAll(async () => {
  storage = await import('../storage/index.js');
});

afterAll(() => {
  fs.rmSync(TMP, { recursive: true, force: true });
});

// A tiny 1x1 PNG as a data URL.
const PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

describe('local image storage', () => {
  test('storeDataUrl writes a file and returns a local /uploads URL', async () => {
    const result = await storage.storeDataUrl(PNG, 'hero');
    expect(result.driver).toBe('local');
    expect(result.url).toMatch(/^\/uploads\/card-images\/hero_[0-9a-f]{16}\.png$/);
    const onDisk = path.join(TMP, result.key);
    expect(fs.existsSync(onDisk)).toBe(true);
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
