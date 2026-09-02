/**
 * Splits `array` into consecutive chunks of at most `size` items.
 * @template T
 * @param {T[]} array
 * @param {number} size
 * @returns {T[][]}
 */
export function chunkArray(array, size) {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`chunkArray: size must be a positive integer, got ${size}`);
  }
  if (!Array.isArray(array) || array.length === 0) return [];

  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
