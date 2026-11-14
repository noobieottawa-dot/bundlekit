import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const dir = path.join(process.cwd(), '.shopify');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const cert = crypto.createCertificate({
  subject: { CN: 'localhost' },
  issuer: { CN: 'localhost' },
  publicKey: publicKey,
  signingKey: privateKey,
});

fs.writeFileSync(path.join(dir, 'localhost-key.pem'), privateKey);
fs.writeFileSync(path.join(dir, 'localhost.pem'), cert);
console.log('Certificats generes avec succes !');