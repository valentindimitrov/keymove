// Start writes in the original user gesture even when a frame must supply the text.
// Safari can lose clipboard activation across an await or extension message.
export async function writeClipboardText(text: string | Promise<unknown>): Promise<void> {
  if (typeof text === 'string') {
    await navigator.clipboard.writeText(text);
    return;
  }
  const validated = text.then(value => {
    if (typeof value !== 'string') throw new Error('This text is no longer available.');
    return value;
  });
  // A denied write may reject before the browser consumes the deferred data.
  void validated.catch(() => {});
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    const data = validated.then(value => new Blob([value], { type: 'text/plain' }));
    void data.catch(() => {});
    await navigator.clipboard.write([new ClipboardItem({ 'text/plain': data })]);
  } else {
    // Older implementations may only support writeText. Do not retry denied writes.
    await navigator.clipboard.writeText(await validated);
  }
}
