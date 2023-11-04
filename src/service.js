import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ipfs } from '../index.js';
import { concat as uint8ArrayConcat } from 'uint8arrays/concat';
import { scryptSync } from 'crypto';

export function fragging(buffer, split_count) {
  const length = buffer.length;
  // buffer.byteLength
  // const split_count = length / frag_length;
  const frag_length = length / split_count;
  const fragments = [];
  for (let i = 0; i < split_count; i++) {
    const subBuffer = buffer.subarray(
      i * frag_length,
      Math.min((i + 1) * frag_length, length)
    );
    // console.log(subBuffer);
    fragments.push(subBuffer);
  }
  // console.log(fragments.map((str) => encoder.encode(str)));
  return fragments;
}

export function encrypt(fragments, ivString) {
  const keys = [];
  const iv = Buffer.from(ivString).subarray(0, 16);
  const encryptedFragments = fragments.map((frag) => {
    const key = scryptSync(randomBytes(16), 'salt', 32);
    // console.log(key);
    const cipher = createCipheriv('aes-256-ctr', key, iv);
    const encrypted = Buffer.concat([cipher.update(frag), cipher.final()]);

    keys.push(key.toString('hex'));
    return encrypted;
  });
  // console.log(keys);
  return { encryptedFragments, keys };
}

export async function ipfsWrite(dataList, path) {
  return Promise.all(
    dataList.map(async (data, i) => {
      await ipfs.files.write(`${path}-${i}`, data, {
        parents: true,
        create: true,
      });
      return ipfs.files
        .stat(`${path}-${i}`)
        .then((result) => result.cid.toString());
    })
  );
}

export async function ipfsRead(cids, path) {
  return Promise.all(
    cids.map(async (cid, i) => {
      const fragPath = `${path}-${i}`;
      // 이미 있으면 cid를 files로 copy해오지 않음.
      await ipfs.files
        .cp(`/ipfs/${cid}`, fragPath, { parents: true })
        .catch(() => console.log('file aleardy exist : ', fragPath));
      const chunks = [];
      for await (const chunk of ipfs.files.read(fragPath)) {
        chunks.push(chunk);
      }
      return uint8ArrayConcat(chunks);
    })
  );
}

export async function decrypt(targetBuffers, keys, ivString) {
  const iv = Buffer.from(ivString).subarray(0, 16);
  const decryptedFrags = targetBuffers.map((buffer, i) => {
    const key = Buffer.from(keys[i], 'hex');
    // console.log(key);
    const decipher = createDecipheriv('aes-256-ctr', key, iv);
    const decryptedBuffer = Buffer.concat([
      decipher.update(buffer),
      decipher.final(),
    ]);
    // console.log(decryptedText);
    return decryptedBuffer;
  });

  return decryptedFrags;
}

export async function unpinAll() {
  const unpinable = [];
  for await (const pinData of ipfs.pin.ls()) {
    if (pinData.type == 'recursive') unpinable.push(pinData);
  }
  for await (const unpinData of ipfs.pin.rmAll(unpinable)) {
    console.log('unpin ', unpinData);
  }
}

export async function filesRemoveAll() {
  for await (const files of ipfs.files.ls('/')) {
    await ipfs.files.rm(`/${files.name}`, { recursive: true });
    console.log(`/${files.name} removed`);
  }
}
