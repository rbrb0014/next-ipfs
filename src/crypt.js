import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from 'crypto';

export class CrpytoService {
  constructor(ivString) {
    this.algorithm = 'aes-256-ctr';
    this.ivString = ivString;
    this.IV = Buffer.from(
      this.ivString >= 16 ? this.ivString : 'default password'
    ).subarray(0, 16);
  }

  createKey() {
    return scryptSync(randomBytes(16), 'salt', 32);
  }

  encrypt(bufferFrags) {
    const keys = [];
    const encryptedBufferFrags = bufferFrags.map((bufferFrag) => {
      const key = this.createKey();
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

  async decrypt(targetBuffers, keys) {
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

  encryptStream(fragStreams) {
    const keys = [];
    const encryptStreams = fragStreams.map((fragStream) => {
      const key = this.createKey();
      const cipher = createCipheriv(algorithm, key, IV);

      keys.push(key.toString('hex'));
      return fragStream.pipe(cipher);
    });

    return { keys, encryptStreams };
  }

  decryptStream(encryptedStreams, keys) {
    return encryptedStreams.map((encryptedStream, i) => {
      const key = Buffer.from(keys[i], 'hex');
      const decipher = createDecipheriv(algorithm, key, IV);

      return encryptedStream.pipe(decipher);
    });
  }
}
