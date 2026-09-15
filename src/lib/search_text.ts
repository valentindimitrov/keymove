// Preserve accents and scripts, while treating canonically equivalent spellings alike.
// Locale-independent casing keeps page text, attributes and queries consistent across tabs.
function normalizeSearchText(text: string): string {
  // ASCII is already NFC and contains neither NBSP nor Greek final sigma.
  if (!/[^\p{ASCII}]/u.test(text)) return text.toLowerCase();
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/\u00a0/g, ' ')
    .replace(/ς/g, 'σ');
}

let graphemes: Intl.Segmenter | undefined;

/** Match normalized text, returning offsets into the unchanged original string. */
function matchingTextSpans(text: string, query: string, limit = Infinity) {
  const needle = normalizeSearchText(query);
  const normalized = normalizeSearchText(text);
  const spans: { start: number; end: number }[] = [];
  if (!needle || limit <= 0) return spans;
  let index = normalized.indexOf(needle);
  if (index === -1) return spans;

  let starts: Uint32Array | undefined;
  let ends: Uint32Array | undefined;
  // Ordinary casing needs no offset map. Segment only an actual match whose spelling
  // changes length or canonical form, including combining marks crossing DOM nodes.
  if (normalized.length !== text.length || text.normalize('NFC') !== text) {
    starts = new Uint32Array(normalized.length);
    ends = new Uint32Array(normalized.length);
    graphemes ??= new Intl.Segmenter('und', { granularity: 'grapheme' });
    let offset = 0;
    for (const part of graphemes.segment(text)) {
      const length = normalizeSearchText(part.segment).length;
      starts.fill(part.index, offset, offset + length);
      ends.fill(part.index + part.segment.length, offset, offset + length);
      offset += length;
    }
  }
  while (index !== -1 && spans.length < limit) {
    const start = starts?.[index] ?? index;
    const end = ends?.[index + needle.length - 1] ?? index + needle.length;
    // A normalized grapheme can contain several occurrences; highlight the original once.
    if (spans.at(-1)?.end !== end) spans.push({ start, end });
    index = normalized.indexOf(needle, index + needle.length);
  }
  return spans;
}

export { matchingTextSpans, normalizeSearchText };
