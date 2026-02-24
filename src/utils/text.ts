/**
 * NoteGenius – Text utilities.
 */

// ─── STT Normalization ────────────────────────────────────────────────────────

/**
 * Word-level substitutions applied to raw STT output before any other
 * normalization. Two categories:
 *
 *  • Informal spoken forms   – words spoken naturally but rarely written
 *    as-is in notes (gonna, wanna, kinda, …).
 *  • Missing apostrophes     – contractions that some STT engines transcribe
 *    without the apostrophe (dont, cant, wont, …).
 *
 * Keys are lowercase; matching is whole-word and case-insensitive so the
 * casing of the replacement preserves the input token's leading case.
 *
 * Intentionally conservative: homophones (their/there, your/you're, its/it's)
 * are NOT included because resolving them requires grammatical context.
 */
const STT_CORRECTIONS: Record<string, string> = {
  // ── Informal spoken forms ───────────────────────────────────────────────
  gonna: "going to",
  wanna: "want to",
  gotta: "got to",
  kinda: "kind of",
  sorta: "sort of",
  lotta: "lot of",
  outta: "out of",
  lotsa: "lots of",
  lemme: "let me",
  gimme: "give me",
  dunno: "don't know",
  hafta: "have to",
  oughta: "ought to",
  tryna: "trying to",
  thru: "through",
  tho: "though",
  cuz: "because",
  cos: "because",
  nah: "no",
  yep: "yes",
  yup: "yes",
  // ── Missing apostrophes in contractions ─────────────────────────────────
  cant: "can't",
  dont: "don't",
  wont: "won't",
  didnt: "didn't",
  doesnt: "doesn't",
  isnt: "isn't",
  arent: "aren't",
  wasnt: "wasn't",
  werent: "weren't",
  havent: "haven't",
  hasnt: "hasn't",
  hadnt: "hadn't",
  wouldnt: "wouldn't",
  couldnt: "couldn't",
  shouldnt: "shouldn't",
  mustnt: "mustn't",
  neednt: "needn't",
  im: "I'm",
  ive: "I've",
  id: "I'd",
  thats: "that's",
  whats: "what's",
  whos: "who's",
  hes: "he's",
  shes: "she's",
  theyre: "they're",
  weve: "we've",
  theyve: "they've",
  youre: "you're",
  youve: "you've",
  youd: "you'd",
  itll: "it'll",
  thatll: "that'll",
  wouldve: "would've",
  couldve: "could've",
  shouldve: "should've",
  mustve: "must've",
};

/**
 * Replace known STT substitution words inside `text`.
 * Preserves the leading-capital of a token: if the source token starts with an
 * uppercase letter (sentence-start), the replacement is also capitalised.
 */
function applySpellingCorrections(text: string): string {
  return text.replace(/\b([A-Za-z']+)\b/g, (token) => {
    const lower = token.toLowerCase();
    const replacement = STT_CORRECTIONS[lower];
    if (!replacement) return token;
    // Preserve leading capitalisation of the original token.
    return token[0] === token[0].toUpperCase() &&
      token[0] !== token[0].toLowerCase()
      ? replacement.charAt(0).toUpperCase() + replacement.slice(1)
      : replacement;
  });
}

/**
 * Lightweight punctuation + capitalization restoration for raw STT output.
 *
 * Steps applied (in order):
 *  1. Trim whitespace.
 *  2. Apply word-level spelling / informal-form corrections.
 *  3. Capitalize the very first character.
 *  4. Capitalize standalone "i" → "I" (common STT regression).
 *  5. Capitalize the first word of each new sentence (after `. `, `! `, `? `).
 *  6. Ensure the text ends with terminal punctuation (`.` added if absent).
 *
 * Entirely rule-based — zero network calls or ML models, offline-safe.
 */
export function normalizeTranscript(raw: string): string {
  let t = raw.trim();
  if (!t) return t;

  // 1. Spelling / informal-form corrections.
  t = applySpellingCorrections(t);

  // 2. Capitalize first character.
  t = t.charAt(0).toUpperCase() + t.slice(1);

  // 3. Fix standalone lowercase "i" (not part of another word).
  t = t.replace(/(?<!\w)i(?!\w)/g, "I");

  // 4. Capitalize the letter that follows sentence-ending punctuation + space.
  t = t.replace(
    /([.!?])\s+([a-z])/g,
    (_, punct, letter) => `${punct} ${letter.toUpperCase()}`,
  );

  // 5. Add a trailing period if the last non-whitespace char is not punctuation.
  if (!/[.!?,;:]$/.test(t)) {
    t += ".";
  }

  return t;
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

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
