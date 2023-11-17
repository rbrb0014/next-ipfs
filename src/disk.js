import 'dotenv/config';
import fs from 'fs';

const split_count = Number(process.env.SPLIT_COUNT);

export async function createFragStreams(filename) {
  const fileSize = fs.statSync(filename).size;
  const fragSize = Math.ceil(fileSize / split_count);

  const fragStreams = [];
  for (let i = 0; i < split_count; i++) {
    const readStream = fs.createReadStream(`./${filename}`, {
      start: i * fragSize,
      end: (i + 1) * fragSize - 1,
    });
    fragStreams.push(readStream);
  }

  return fragStreams;
}
