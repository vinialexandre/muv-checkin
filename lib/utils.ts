/**
 * Normalizes text by removing accents and converting to lowercase
 * for accent-insensitive search functionality
 */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}