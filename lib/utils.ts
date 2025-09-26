/**
 * Normalizes text by removing accents and converting to lowercase
 * for accent-insensitive search functionality
 */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

const SLUG_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';

function getRandomBytes(length: number): number[] {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const array = new Uint8Array(length);
    globalThis.crypto.getRandomValues(array);
    return Array.from(array);
  }
  const fallback: number[] = [];
  for (let i = 0; i < length; i++) fallback.push(Math.floor(Math.random() * 256));
  return fallback;
}

/**
 * Generates a short public slug using URL-safe characters and crypto randomness.
 */
export function generateSlug(length = 8): string {
  if (length <= 0) return '';
  const bytes = getRandomBytes(length);
  let slug = '';
  for (let i = 0; i < length; i++) {
    slug += SLUG_ALPHABET.charAt(bytes[i] % SLUG_ALPHABET.length);
  }
  return slug;
}
