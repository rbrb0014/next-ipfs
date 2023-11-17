import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';
import 'dotenv/config';

const algorithm = 'aes-256-ctr';
const ivString = process.env.IV_STRING;
const IV = Buffer.from(ivString >= 16 ? ivString : 'default password').subarray(
  0,
  16
);

export function encrypt(bufferFrags) {
  const keys = [];
  const encryptedBufferFrags = bufferFrags.map((bufferFrag) => {
    const key = scryptSync(randomBytes(16), 'salt', 32);
    const cipher = createCipheriv(algorithm, key, IV);

    const encryptedBufferFrag = Buffer.concat([
      cipher.update(bufferFrag),
      cipher.final(),
    ]);

    keys.push(key.toString('hex'));
    return encryptedBufferFrag;
  });

  return { encryptedBufferFrags, keys };
}

export async function decrypt(targetBuffers, keys) {
  const decryptedBufferFrags = targetBuffers.map((buffer, i) => {
    const key = Buffer.from(keys[i], 'hex');
    const decipher = createDecipheriv(algorithm, key, IV);

    const decryptedBufferFrag = Buffer.concat([
      decipher.update(buffer),
      decipher.final(),
    ]);
    return decryptedBufferFrag;
  });

  return decryptedBufferFrags;
}

export function encryptStream(fragStreams) {
  const keys = [];
  const encryptStreams = fragStreams.map((fragStream) => {
    const key = scryptSync(randomBytes(16), 'salt', 32);
    const cipher = createCipheriv(algorithm, key, IV);

    keys.push(key.toString('hex'));
    return fragStream.pipe(cipher);
  });

  return { keys, encryptStreams };
}

export function decryptStream(encryptedStreams, keys) {
  return encryptedStreams.map((encryptedStream, i) => {
    const key = Buffer.from(keys[i], 'hex');
    const decipher = createDecipheriv(algorithm, key, IV);

    return encryptedStream.pipe(decipher);
  });
}
