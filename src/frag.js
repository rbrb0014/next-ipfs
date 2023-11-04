import 'dotenv/config';

const split_count = Number(process.env.SPLIT_COUNT);

export function frag(buffer) {
  const maxLength = buffer.length;
  const frag_length = maxLength / split_count;
  const fragments = [];
  for (let i = 0; i < split_count; i++) {
    // frag from front, last fragment ends to buffer's end
    const bufferFrag = buffer.subarray(
      i * frag_length,
      Math.min((i + 1) * frag_length, maxLength)
    );
    fragments.push(bufferFrag);
  }
  return fragments;
}

export function mergeFrags(frags) {
  return frags.reduce((prev, curr) => Buffer.concat([prev, curr]));
}
