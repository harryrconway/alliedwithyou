/*
  Six digit codes from an authenticator app secret, for testing two step sign in.
  A code is only used once: if the current one was just used, this waits for the next.
*/
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const used = new Map();

function decode(secret) {
  let bits = '';
  for (const c of secret.replace(/=+$/, '').toUpperCase()) {
    const v = ALPHABET.indexOf(c);
    if (v >= 0) bits += v.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(bytes);
}

function code(secret, at) {
  const counter = Math.floor((at || Date.now()) / 30000);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 15;
  const n = ((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1000000).padStart(6, '0');
}

async function fresh(secret) {
  let c = code(secret);
  if (used.get(secret) === c) {
    await new Promise((resolve) => setTimeout(resolve, 30000 - (Date.now() % 30000) + 500));
    c = code(secret);
  }
  used.set(secret, c);
  return c;
}

module.exports = { code, fresh };
