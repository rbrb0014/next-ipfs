import 'dotenv/config';
import fs from 'fs';
import stream from 'stream';

const split_count = Number(process.env.SPLIT_COUNT);

export async function createFragStreams(sourceStream, fileSize) {
  const fragSize = Math.ceil(fileSize / split_count);

  // 5개의 PassThrough 스트림을 생성합니다.
  const destStreams = Array.from({ length: 5 }, () => new stream.PassThrough());

  const transformStream = new stream.Transform({
    transform(chunk, encoding, callback) {
      for (let i = 0; i < split_count; i++) {
        // 각 부분의 시작과 끝 인덱스를 계산합니다.
        const start = i * fragSize;
        const end = Math.min((i + 1) * fragSize, chunk.length);

        // 각 부분을 해당 목적지 스트림에 씁니다.
        destStreams[i].write(chunk.slice(start, end));
      }

      callback();
    },
  });
  // 원본 스트림을 Transform 스트림에 연결합니다.
  sourceStream.pipe(transformStream);

  transformStream.on('finish', () => {
    destStreams.forEach((destStream) => destStream.end());
  });

  return destStreams;
}

export async function createDiskFragStreams(filename) {
  const fileSize = fs.statSync(`upload/${filename}`).size;
  const fragSize = Math.ceil(fileSize / split_count);

  const fragStreams = [];
  for (let i = 0; i < split_count; i++) {
    const readStream = fs.createReadStream(`upload/${filename}`, {
      start: i * fragSize,
      end: (i + 1) * fragSize - 1,
    });
    fragStreams.push(readStream);
  }

  return fragStreams;
}
