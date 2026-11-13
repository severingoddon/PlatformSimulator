/**
 * Random ID for one event or submission. If a request is retried after a network
 * problem, the server sees the same ID again and ignores the duplicate.
 */
export function newRequestId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for plain-HTTP pages, where randomUUID is not available
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
