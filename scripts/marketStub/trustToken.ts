#!/usr/bin/env bun
/**
 * Trust-token credential generator and validator for the local Market stub.
 *
 * The SDK encrypts tokens as: base64( 12-byte IV | AES-256-GCM ciphertext | 16-byte auth-tag )
 * Key derivation: if secret starts with "lobehub-market_tcs_" → sha256(secret);
 *                 otherwise → Buffer.from(secret, 'hex') (must be 32 bytes).
 *
 * Secrets generated here use the prefix form so the same sha256 path is exercised.
 */

import { createDecipheriv, createHash, randomBytes } from 'node:crypto';

export const SECRET_PREFIX = 'lobehub-market_tcs_';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const NONCE_WINDOW_MS = 5 * 60 * 1000;

export interface TrustTokenPayload {
  clientId: string;
  email?: string;
  name?: string;
  nonce: string;
  timestamp: number;
  userId: string;
}

export interface ValidateOk {
  ok: true;
  payload: TrustTokenPayload;
}
export interface ValidateFail {
  ok: false;
  reason: string;
}

// In-memory nonce replay protection (5-min window, keyed by nonce → expiry ms)
const seenNonces = new Map<string, number>();

function deriveKey(secret: string): Buffer {
  if (secret.startsWith(SECRET_PREFIX)) {
    return createHash('sha256').update(secret).digest();
  }
  const key = Buffer.from(secret, 'hex');
  if (key.length !== 32) throw new Error(`Invalid key length: ${key.length}; expected 32`);
  return key;
}

function pruneNonces() {
  const now = Date.now();
  for (const [nonce, expiry] of seenNonces) {
    if (now > expiry) seenNonces.delete(nonce);
  }
}

export function validateTrustToken(
  tokenB64: string,
  expectedClientId: string,
  secret: string,
): ValidateOk | ValidateFail {
  let buf: Buffer;
  try {
    buf = Buffer.from(tokenB64, 'base64');
  } catch {
    return { ok: false, reason: 'invalid base64' };
  }

  if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    return { ok: false, reason: 'token too short' };
  }

  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(buf.length - AUTH_TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH, buf.length - AUTH_TAG_LENGTH);

  let payload: TrustTokenPayload;
  try {
    const key = deriveKey(secret);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString(
      'utf8',
    );
    payload = JSON.parse(plaintext);
  } catch {
    return { ok: false, reason: 'decryption failed (wrong secret or tampered)' };
  }

  if (payload.clientId !== expectedClientId) {
    return { ok: false, reason: `clientId mismatch: got ${payload.clientId}` };
  }

  if (Math.abs(Date.now() - payload.timestamp) > NONCE_WINDOW_MS) {
    return { ok: false, reason: 'token expired (>5 min clock skew)' };
  }

  pruneNonces();
  if (seenNonces.has(payload.nonce)) {
    return { ok: false, reason: 'nonce replayed' };
  }
  seenNonces.set(payload.nonce, Date.now() + NONCE_WINDOW_MS);

  return { ok: true, payload };
}

export interface GeneratedCredentials {
  clientId: string;
  secret: string;
}

export function generateCredentials(): GeneratedCredentials {
  const clientId = `local-stub-${randomBytes(4).toString('hex')}`;
  // PREFIX (19 chars) + 64 hex chars (32 bytes) = 83 chars — satisfies zod .length(83)
  const secret = SECRET_PREFIX + randomBytes(32).toString('hex');
  return { clientId, secret };
}

export function printDotEnvBlock(creds: GeneratedCredentials): string {
  return [
    `MARKET_BASE_URL=http://localhost:3000`,
    `MARKET_TRUSTED_CLIENT_ID=${creds.clientId}`,
    `MARKET_TRUSTED_CLIENT_SECRET=${creds.secret}`,
  ].join('\n');
}
