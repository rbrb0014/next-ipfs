import { createCipheriv, createDecipheriv, scrypt } from 'crypto';
import { ipfs } from '../index.js';
import { promisify } from 'util';
import { concat as uint8ArrayConcat } from 'uint8arrays/concat';
import { scryptSync } from 'crypto';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export function fragging(buffer, split_count) {
  const length = buffer.length;
  // buffer.byteLength
  const frag_length = length / split_count;
  const fragments = [];
  for (let i = 0; i < split_count; i++) {
    const subBuffer = buffer.subarray(
      i * frag_length,
      Math.min((i + 1) * frag_length, length)
    );
    // console.log(subBuffer);
    fragments.push(subBuffer.toString('utf8'));
  }
  // console.log(fragments.map((str) => encoder.encode(str)));
  return fragments;
}

export function encrypt(fragments, keyString, ivString) {
  const encryptedFragments = [];
  const keys = [];
  const iv = Buffer.from(ivString).subarray(0, 16);
  for (let i = 0; i < fragments.length; i++) {
    const frag = fragments[i];
    const key = scryptSync(keyString, 'salt', 32);
    console.log(key);
    const cipher = createCipheriv('aes-256-ctr', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(frag, 'utf8'),
      cipher.final(),
    ]);

    encryptedFragments.push(encrypted.toString());
    keys.push(key.toString());
  }
  console.log(keys);
  return { encryptedFragments, keys };
}

export async function ipfsWrite(dataList, path) {
  const cids = [];
  for (let i = 0; i < dataList.length; i++) {
    const data = dataList[i];
    // const data = encoder.encode(dataList[i]);
    await ipfs.files.write(`/${path}/${i}`, data, {
      parents: true,
      create: true,
    });
    const result = await ipfs.files.stat(`/${path}/${i}`);
    cids.push(result.cid.toString());
  }

  return cids;
}

export async function ipfsRead(path, cids) {
  const bufferStrings = [];
  for (let i = 0; i < cids.length; i++) {
    const chunks = [];
    for await (const chunk of ipfs.files.read(`/${path}/${i}`)) {
      chunks.push(chunk);
    }
    const bufferString = uint8ArrayConcat(chunks).toString('utf8');
    // console.log(bufferHexString);
    bufferStrings.push(bufferString);
  }
  // console.log(bufferHexStrings);
  return bufferStrings;
}

export async function decrypt(targetStrings, keys, ivString) {
  const iv = Buffer.from(ivString).subarray(0, 16);
  const decrypts = [];
  for (let i = 0; i < targetStrings.length; i++) {
    const key = Buffer.from(keys[i]);
    console.log(key);
    const decipher = createDecipheriv('aes-256-ctr', key, iv);
    const encryptedText = Buffer.from(targetStrings[i]);
    const decryptedText = Buffer.concat([
      decipher.update(encryptedText),
      decipher.final(),
    ]);
    // console.log(decryptedText);
    decrypts.push(decryptedText);
  }
  return decrypts.reduce((prev, curr) => Buffer.concat([prev, curr]));
}
