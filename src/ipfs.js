import { create } from 'kubo-rpc-client';
import { concat as uint8ArrayConcat } from 'uint8arrays/concat';
import { Readable } from 'stream';

export class IpfsService {
  ipfs = null;
  constructor(url) {
    this.ipfs = create({ url });

    return this;
  }
  async connect() {
    return this.ipfs.id().then(
      () => console.log('ipfs connected'),
      () => {
        throw new Error('ipfs not connected');
      }
    );
  }

  async ipfsWrite(dataList, path) {
    return Promise.all(
      dataList.map(async (data, i) => {
        await this.ipfs.files.write(`${path}-${i}`, data, {
          parents: true,
          create: true,
        });
        return this.ipfs.files
          .stat(`${path}-${i}`, { hash: true })
          .then((result) => result.cid.toString());
      })
    );
  }

  async ipfsRead(cids, path) {
    return Promise.all(
      cids.map(async (cid, i) => {
        const fragPath = `${path}-${i}`;
        // 이미 있으면 cid를 files로 copy해오지 않음.
        await this.ipfs.files
          .cp(`/ipfs/${cid}`, fragPath, { parents: true })
          .catch(() =>
            console.log('ipfs file cp :', fragPath, 'already exist')
          );
        const chunks = [];
        for await (const chunk of this.ipfs.files.read(fragPath)) {
          chunks.push(chunk);
        }
        return uint8ArrayConcat(chunks);
      })
    );
  }

  async ipfsWriteStream(dataStreams) {
    return Promise.all(
      dataStreams.map(async (dataStream) =>
        this.ipfs.add(dataStream).then((result) => result.cid.toString())
      )
    );
  }

  ipfsReadStream(cids) {
    return cids.map((cid) => Readable.from(this.ipfs.cat(cid)));
  }

  async unpinAll() {
    const unpinable = [];
    for await (const pinData of this.ipfs.pin.ls()) {
      if (pinData.type == 'recursive') unpinable.push(pinData);
    }
    for await (const unpinData of this.ipfs.pin.rmAll(unpinable)) {
      console.log('unpin ', unpinData);
    }
  }

  async filesRemoveAll() {
    for await (const files of this.ipfs.files.ls('/')) {
      await this.ipfs.files.rm(`/${files.name}`, { recursive: true });
      console.log(`/${files.name} removed`);
    }
  }
}
