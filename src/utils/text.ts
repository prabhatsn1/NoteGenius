/**
 * NoteGenius – Text utilities.
 */

/**
 * Split text into chunks of approximately `maxChars` characters,
 * breaking at sentence boundaries when possible.
 */
export function chunkText(text: string, maxChars = 4000): string[] {
  if (text.length <= maxChars) return [text];

  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (current.length + sentence.length + 1 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = "";
    }
    current += (current ? " " : "") + sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
