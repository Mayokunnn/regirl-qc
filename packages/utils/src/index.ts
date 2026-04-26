export const stableHash = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
};

export const seededFloat = (seed: string): number => {
  const hash = stableHash(seed);
  return (hash % 1000) / 1000;
};
