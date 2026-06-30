// Image storage. Uses S3 when S3_BUCKET is configured; otherwise falls back to
// local disk under server/uploads (served at /uploads). All the S3 plumbing is
// here — set S3_BUCKET / AWS_REGION (+ standard AWS credentials) and it switches over.
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Server runs from app/ (npm run server / server:dev); override with R5C_UPLOADS_DIR.
export const UPLOADS_DIR = process.env.R5C_UPLOADS_DIR || path.join(process.cwd(), 'server', 'uploads');

const S3_BUCKET = process.env.S3_BUCKET || null;
const AWS_REGION = process.env.AWS_REGION || 'eu-west-1';
const S3_PUBLIC_BASE = process.env.S3_PUBLIC_BASE ||
  (S3_BUCKET ? `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com` : null);

const s3 = S3_BUCKET ? new S3Client({ region: AWS_REGION }) : null;

const EXT_BY_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4'
};

const parseDataUrl = (dataUrl) => {
  const match = /^data:([a-z]+\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
};

const keyFor = (buffer, mime, hint) => {
  const hash = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 16);
  const ext = EXT_BY_MIME[mime] || 'bin';
  const safeHint = String(hint || 'img').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32);
  return `card-images/${safeHint}_${hash}.${ext}`;
};

const storeLocal = (key, buffer) => {
  const filePath = path.join(UPLOADS_DIR, key);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, buffer);
  return `/uploads/${key}`;
};

const storeS3 = async (key, buffer, mime) => {
  await s3.send(new PutObjectCommand({
    Bucket: S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: mime,
    CacheControl: 'public, max-age=31536000, immutable'
  }));
  return `${S3_PUBLIC_BASE}/${key}`;
};

// Store a raw buffer (e.g. a rendered GIF/MP4). Key is content-hashed so identical
// renders dedupe; returns { url, key, driver }.
export const storeBuffer = async (buffer, mime, hint) => {
  const key = keyFor(buffer, mime, hint);
  const url = s3
    ? await storeS3(key, buffer, mime)
    : storeLocal(key, buffer);
  return { url, key, driver: s3 ? 's3' : 'local' };
};

// Store a data URL; returns { url, key, driver } or null if not a valid image data URL.
export const storeDataUrl = async (dataUrl, hint) => {
  const parsed = parseDataUrl(dataUrl);
  if (!parsed) return null;
  const key = keyFor(parsed.buffer, parsed.mime, hint);
  const url = s3
    ? await storeS3(key, parsed.buffer, parsed.mime)
    : storeLocal(key, parsed.buffer);
  return { url, key, driver: s3 ? 's3' : 'local' };
};

export const deleteByKey = async (key) => {
  if (s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } else {
    const filePath = path.join(UPLOADS_DIR, key);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
};

// Walk an object tree, replacing every data:image/...;base64 string with a stored URL.
// Returns { value, stored: [{path, key, url}] }. Keeps everything else untouched.
export const offloadImages = async (value, hint = 'card', trail = '', stored = []) => {
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) {
      const result = await storeDataUrl(value, hint);
      if (result) {
        stored.push({ path: trail, key: result.key, url: result.url });
        return { value: result.url, stored };
      }
    }
    return { value, stored };
  }
  if (Array.isArray(value)) {
    const out = [];
    for (let i = 0; i < value.length; i++) {
      out.push((await offloadImages(value[i], hint, `${trail}[${i}]`, stored)).value);
    }
    return { value: out, stored };
  }
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = (await offloadImages(v, hint, trail ? `${trail}.${k}` : k, stored)).value;
    }
    return { value: out, stored };
  }
  return { value, stored };
};

export const storageInfo = () => ({
  driver: s3 ? 's3' : 'local',
  bucket: S3_BUCKET,
  region: s3 ? AWS_REGION : null,
  uploadsDir: s3 ? null : UPLOADS_DIR
});
