export class FragService {
  splitCount = 1;
  constructor(splitCount) {
    this.splitCount = Number(splitCount) ?? 1;

    return this;
  }

  frag(buffer) {
    const maxLength = buffer.length;
    const fragLength = maxLength / this.splitCount;
    const fragments = [];
    for (let i = 0; i < this.splitCount; i++) {
      // frag from front, last fragment ends to buffer's end
      const bufferFrag = buffer.subarray(
        i * fragLength,
        Math.min((i + 1) * fragLength, maxLength)
      );
      fragments.push(bufferFrag);
    }
    return fragments;
  }

  mergeFrags(frags) {
    return frags.reduce((prev, curr) => Buffer.concat([prev, curr]));
  }
}
