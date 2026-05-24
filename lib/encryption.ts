import crypto from 'crypto';

const ALGO = 'aes-256-gcm';
const IV_LENGTH = 12; // recommended for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY not set in environment');

  // Accept base64, hex, or raw 32-byte string
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
    if (key.length === 32) return key;
  } catch (_) {}

  try {
    key = Buffer.from(raw, 'hex');
    if (key.length === 32) return key;
  } catch (_) {}

  const rawBuf = Buffer.from(raw, 'utf8');
  if (rawBuf.length === 32) return rawBuf;

  throw new Error('ENCRYPTION_KEY must be 32 bytes (raw) or base64/hex for a 32-byte key');
}

export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const out = Buffer.concat([iv, tag, ciphertext]);
  return out.toString('base64');
}

export function decrypt(payload: string): string {
  const key = getKey();
  const buf = Buffer.from(payload, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH) throw new Error('Invalid encrypted payload');

  const iv = buf.slice(0, IV_LENGTH);
  const tag = buf.slice(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.slice(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString('utf8');
}

export function encryptJSON(obj: unknown): string {
  return encrypt(JSON.stringify(obj));
}

export function decryptJSON<T = any>(payload: string): T {
  const raw = decrypt(payload);
  return JSON.parse(raw) as T;
}
