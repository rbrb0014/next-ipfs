import { create } from 'kubo-rpc-client';
import { concat as uint8ArrayConcat } from 'uint8arrays/concat';
import stream from 'stream';

export const ipfs = create({ url: 'http://127.0.0.1:5001/api/v0' });
await ipfs.id().then(() => console.log('ipfs connected'));

export async function ipfsWriteStream(dataStreams) {
  return Promise.all(
    dataStreams.map(async (dataStream) =>
      ipfs.add(dataStream).then((result) => result.cid.toString())
    )
  );
}

export async function ipfsWrite(dataList, path) {
  return Promise.all(
    dataList.map(async (data, i) => {
      await ipfs.files.write(`${path}-${i}`, data, {
        parents: true,
        create: true,
      });
      return ipfs.files
        .stat(`${path}-${i}`, { hash: true })
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
        .catch(() => console.log('ipfs file cp :', fragPath, 'already exist'));
      const chunks = [];
      for await (const chunk of ipfs.files.read(fragPath)) {
        chunks.push(chunk);
      }
      return uint8ArrayConcat(chunks);
    })
  );
}

export function ipfsReadStream(cids) {
  return cids.map((cid) => stream.Readable.from(ipfs.cat(cid)));
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
