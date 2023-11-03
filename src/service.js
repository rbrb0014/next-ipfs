export function fragging(buffer, split_count) {
  const length = buffer.length;
  // buffer.byteLength
  const frag_length = length / split_count;
  const fragments = [];
  for (let i = 0; i < split_count; i++) {
    fragments.push(
      buffer.subarray(i * frag_length, Math.min((i + 1) * frag_length, length))
    );
  }

  return fragments;
}
