/** scrypt PIN hashing (pure, unit-tested). The PIN never leaves the server in any form. */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;

const KEY_LEN = 32;
const PARAMS = { N: 16384, r: 8, p: 1 };

export interface PinHash {
  hash: string; // base64
  salt: string; // base64
  algo: 'scrypt-16384-8-1';
}

export async function hashPin(pin: string): Promise<PinHash> {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, KEY_LEN, PARAMS);
  return { hash: key.toString('base64'), salt: salt.toString('base64'), algo: 'scrypt-16384-8-1' };
}

export async function checkPin(pin: string, stored: Pick<PinHash, 'hash' | 'salt'>): Promise<boolean> {
  const key = await scrypt(pin, Buffer.from(stored.salt, 'base64'), KEY_LEN, PARAMS);
  const expected = Buffer.from(stored.hash, 'base64');
  return expected.length === key.length && timingSafeEqual(expected, key);
}
