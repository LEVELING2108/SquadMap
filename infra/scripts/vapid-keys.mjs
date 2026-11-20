// Prints a new VAPID key pair for push notifications, in the form the backend reads.
// Usage: node infra/scripts/vapid-keys.mjs
// Put both lines in backend/.env.local (development) or the server's .env (production).
import { generateKeyPairSync } from 'node:crypto';

const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });

const raw = Buffer.concat([
  Buffer.from([0x04]),
  Buffer.from(pub.x, 'base64url'),
  Buffer.from(pub.y, 'base64url'),
]);

console.log(`VAPID_PUBLIC_KEY=${raw.toString('base64url')}`);
console.log(`VAPID_PRIVATE_KEY=${priv.d}`);
