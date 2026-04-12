/**
 * Deterministic text chunking for knowledge base ingestion.
 *
 * Strategy:
 *   1. If text length < minChars: return single chunk
 *   2. Split by paragraph (\n\n)
 *   3. If a paragraph > maxChars, split by sentence (。 or .)
 *   4. If a sentence still > maxChars, hard-split by character count
 *   5. Greedily pack pieces into chunks of [minChars, maxChars]
 *   6. Add overlap characters from the tail of previous chunk to head of next
 */

export interface ChunkOptions {
  minChars?: number;
  maxChars?: number;
  overlap?: number;
}

const DEFAULT_OPTS: Required<ChunkOptions> = {
  minChars: 500,
  maxChars: 800,
  overlap: 50,
};

/**
 * Chunk a text into segments suitable for embedding.
 * Returns array of chunk strings (not empty, trimmed).
 */
export function chunkText(text: string, options: ChunkOptions = {}): string[] {
  const opts = { ...DEFAULT_OPTS, ...options };
  const cleaned = text.replace(/\r\n/g, "\n").trim();

  if (!cleaned) return [];
  if (cleaned.length < opts.minChars) {
    return [cleaned];
  }

  const pieces = splitIntoPieces(cleaned, opts.maxChars);
  return packPieces(pieces, opts);
}

/**
 * Split text into the smallest atomic pieces by paragraph → sentence → hard split.
 */
function splitIntoPieces(text: string, maxChars: number): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const result: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= maxChars) {
      result.push(para);
      continue;
    }

    // Split by sentence punctuation, keeping the punctuation with the sentence
    const sentences = splitBySentence(para);
    for (const sentence of sentences) {
      if (sentence.length <= maxChars) {
        result.push(sentence);
        continue;
      }
      // Final fallback: hard split by character count
      for (let i = 0; i < sentence.length; i += maxChars) {
        result.push(sentence.slice(i, i + maxChars));
      }
    }
  }

  return result;
}

/**
 * Split text by sentence delimiters (Chinese 。 ！ ？ and English . ! ?),
 * keeping the delimiter attached to the preceding sentence.
 */
function splitBySentence(text: string): string[] {
  const result: string[] = [];
  let buffer = "";

  for (const ch of text) {
    buffer += ch;
    if (ch === "。" || ch === "！" || ch === "？" || ch === "." || ch === "!" || ch === "?") {
      const trimmed = buffer.trim();
      if (trimmed) result.push(trimmed);
      buffer = "";
    }
  }

  const tail = buffer.trim();
  if (tail) result.push(tail);

  return result;
}

/**
 * Greedily pack pieces into chunks within [minChars, maxChars].
 * Adds overlap from the tail of the previous chunk to the head of the next chunk.
 */
function packPieces(pieces: string[], opts: Required<ChunkOptions>): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const piece of pieces) {
    if (!current) {
      current = piece;
      continue;
    }

    const projected = `${current}\n${piece}`;
    if (projected.length <= opts.maxChars) {
      current = projected;
      continue;
    }

    // Current chunk is "full enough" — flush it
    if (current.length >= opts.minChars) {
      chunks.push(current);
      // Start next chunk with overlap from current tail
      const overlap = current.slice(Math.max(0, current.length - opts.overlap));
      current = `${overlap}\n${piece}`;
    } else {
      // Below minChars — try to keep accumulating even if we exceed maxChars slightly
      // Better to have a slightly oversized chunk than a tiny one
      if (current.length + piece.length <= opts.maxChars * 1.5) {
        current = projected;
      } else {
        chunks.push(current);
        const overlap = current.slice(Math.max(0, current.length - opts.overlap));
        current = `${overlap}\n${piece}`;
      }
    }
  }

  if (current.trim()) {
    chunks.push(current);
  }

  return chunks.map((c) => c.trim()).filter(Boolean);
}

/**
 * Build a snippet (short preview) from a chunk for UI display.
 */
export function buildSnippet(chunk: string, maxLength = 200): string {
  const trimmed = chunk.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) return trimmed;
  return trimmed.slice(0, maxLength) + "…";
}
