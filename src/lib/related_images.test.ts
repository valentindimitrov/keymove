import { RelatedImageSelection, relatedImages } from './related_images.js';
import { isImageInfo, isImageCommand, imageUrl } from './image_schema.js';

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 180));
});
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test('stays in the selected card, ignores icons and hidden slides, and cycles photos', () => {
  document.body.innerHTML =
    '<div><div><a href="https://example.com/shoe"><img src="/a.png"><img src="/b.png"><img hidden src="/hidden.png"><img role="presentation" src="/icon.png"></a><p>Samba</p></div><div><img src="/other.png"><p>Other shoe</p></div></div>';
  const source = document.querySelector('p')!;
  const selection = new RelatedImageSelection();
  const first = selection.next(source)!;
  expect(first.url).toContain('/a.png');
  expect(first.count).toBe(2);
  expect(first.link).toBe('https://example.com/shoe');
  const second = selection.next(source)!;
  expect(second.url).toContain('/b.png');
  expect(selection.info(first.token)).toBeNull();
  expect(selection.next(source)?.url).toContain('/a.png');
});

test('does not borrow another card or a page-wide image', () => {
  document.body.innerHTML =
    '<main><div><div><p>No image here</p></div><div><img src="/other.png"><p>Other card</p></div></div><img src="/hero.png"></main>';
  expect(relatedImages(document.querySelector('p')!)).toBeNull();
});

test('associates split image and description links inside a card with wishlist text', () => {
  // The image header contains a screen-reader-only button label. It is not a
  // second product caption (the structure used by Adidas product cards).
  document.body.innerHTML = `
    <main><article><div>
      <header><div><button><span>Add to wishlist</span></button></div>
        <a href="/white-shoe"><img src="/white.png"></a>
      </header>
      <a id="description" href="/white-shoe"><footer><p>Stan Smith</p></footer></a>
    </div></article>
    <article><div><header><img src="/black.png"></header>
      <footer><p>Stan Smith</p></footer></div></article></main>`;
  const image = document.querySelector('img')!;
  expect(relatedImages(document.querySelector('p')!)?.images).toEqual([image]);
  expect(relatedImages(document.getElementById('description')!)?.images).toEqual([image]);
});

test('does not treat an outer article as permission to borrow a nested neighbouring card', () => {
  document.body.innerHTML = `<article><div><p>No photograph</p></div>
    <article><header><img src="/other.png"></header><p>Other product</p></article></article>`;
  expect(relatedImages(document.querySelector('p')!)).toBeNull();
});

test('follows open roots and slots without selecting unrendered light DOM', () => {
  document.body.innerHTML =
    '<article><div id="host"><p slot="caption">Camera</p><img src="/unassigned.png"></div></article>';
  const host = document.getElementById('host')!;
  host.attachShadow({ mode: 'open' }).innerHTML =
    '<figure><img src="/camera.png"><slot name="caption"></slot></figure>';
  expect(relatedImages(host.querySelector('p')!)?.images.map(node => node.src)).toEqual([
    expect.stringContaining('/camera.png'),
  ]);
});

test('invalidates removed, hidden and replaced-source images before acting', () => {
  document.body.innerHTML = '<figure><img src="/a.png"><figcaption>Shoe</figcaption></figure>';
  const source = document.querySelector('figcaption')!;
  const img = document.querySelector('img')!;
  const selection = new RelatedImageSelection();
  let info = selection.next(source)!;
  img.src = '/b.png';
  expect(selection.info(info.token)).toBeNull();
  info = selection.next(source)!;
  img.hidden = true;
  expect(selection.info(info.token)).toBeNull();
  img.hidden = false;
  img.remove();
  expect(selection.activate(info.token)).toBe(false);
});

test('respects modal scope and ignores clipped carousel slides', () => {
  document.body.innerHTML =
    '<figure><div style="overflow-x:hidden"><img src="/visible.png"><img src="/clipped.png"></div><figcaption>Camera</figcaption></figure>';
  const source = document.querySelector('figcaption')!;
  const clipped = document.querySelectorAll('img')[1]!;
  vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
    return new DOMRect(this === clipped ? 300 : 0, 0, 200, 180);
  });
  expect(relatedImages(source)?.images).toEqual([document.querySelector('img')]);
  const selection = new RelatedImageSelection();
  const info = selection.next(source)!;
  document.body.insertAdjacentHTML('beforeend', '<div role="dialog" aria-modal="true">Modal</div>');
  expect(selection.info(info.token)).toBeNull();
  expect(relatedImages(source)).toBeNull();
});

test('requires a current image and reports unavailable clipboard support', async () => {
  document.body.innerHTML = '<figure><img src="/a.png"><figcaption>Shoe</figcaption></figure>';
  const img = document.querySelector('img')!;
  Object.defineProperties(img, {
    complete: { value: true },
    naturalWidth: { value: 200 },
    naturalHeight: { value: 100 },
  });
  const selection = new RelatedImageSelection();
  const info = selection.next(document.querySelector('figcaption')!)!;
  await expect(selection.copy('stale')).rejects.toThrow('unavailable');
  await expect(selection.copy(info.token)).rejects.toThrow('unavailable');
});

test('validates image messages and rejects executable and non-image data URLs', () => {
  expect(imageUrl('javascript:alert(1)')).toBeNull();
  expect(imageUrl('data:text/html,hello')).toBeNull();
  expect(imageUrl('data:image/svg+xml,<svg/>')).toBeNull();
  expect(isImageCommand({ image: 'eval', token: '' })).toBe(false);
  expect(isImageCommand({ image: 'right', token: 'current' })).toBe(true);
  expect(
    isImageInfo({
      token: 'a',
      url: 'https://example.com/a.png',
      label: 'A',
      link: null,
      position: 1,
      count: 2,
    }),
  ).toBe(true);
  expect(
    isImageInfo({
      token: 'a',
      url: 'javascript:alert(1)',
      label: 'A',
      link: null,
      position: 1,
      count: 2,
    }),
  ).toBe(false);
});

test('moves spatially across cards and open roots, retaining the original result', async () => {
  document.body.innerHTML = `<main><article><img id="first" src="/first.png"><p>Original</p></article>
    <article><a href="https://example.com/right"><img id="right" src="/right.png"></a></article><div id="host"></div>
    <img hidden id="hidden" src="/hidden.png"></main>`;
  const shadow = document.getElementById('host')!.attachShadow({ mode: 'open' });
  shadow.innerHTML = '<img id="below" src="/below.png">';
  vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
    return new DOMRect(
      this.id === 'right' ? 240 : this.id === 'hidden' ? 210 : 0,
      this.id === 'below' ? 240 : 0,
      200,
      180,
    );
  });
  const source = document.querySelector('p')!;
  const selection = new RelatedImageSelection();
  let info = selection.next(source)!;
  const firstToken = info.token;
  info = (await selection.move(info.token, 'right'))!;
  expect(info.url).toContain('/right.png');
  expect(selection.source).toBe(source);
  const clicked = vi.fn((event: Event) => event.preventDefault());
  document.querySelector('a')!.addEventListener('click', clicked);
  expect(selection.activate(info.token)).toBe(true);
  expect(clicked).toHaveBeenCalledTimes(1);
  expect(await selection.move(firstToken, 'left')).toBeNull();
  info = (await selection.move(info.token, 'left'))!;
  expect(info.url).toContain('/first.png');
  info = (await selection.move(info.token, 'down'))!;
  expect(info.url).toContain('/below.png');
  info = (await selection.move(info.token, 'up'))!;
  expect(info.url).toContain('/first.png');
  expect(await selection.move(info.token, 'left')).toEqual(info);
});

test('cancels a chunked directional lookup when selection is cleared', async () => {
  document.body.innerHTML = `<article><img src="/start.png"><p>Original</p></article>
    <div>${'<span></span>'.repeat(250)}<img id="end" src="/end.png"></div>`;
  vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
    return new DOMRect(this.id === 'end' ? 250 : 0, 0, 200, 180);
  });
  const selection = new RelatedImageSelection();
  const info = selection.next(document.querySelector('p')!)!;
  const moving = selection.move(info.token, 'right');
  selection.clear();
  expect(await moving).toBeNull();
  expect(selection.node).toBeNull();
});

test('crosses a deeply nested content/sidebar boundary in both directions', async () => {
  document.body.innerHTML = `<main><section>${'<div>'.repeat(13)}
    <img id="large" src="/large.png"><p>Large</p>${'</div>'.repeat(13)}
    ${'<span></span>'.repeat(1400)}</section>
    <aside><img id="small" src="/small.png"></aside></main>`;
  vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
    return this.id === 'small' ? new DOMRect(500, 50, 80, 80) : new DOMRect(0, 100, 300, 300);
  });
  const selection = new RelatedImageSelection();
  let info = selection.next(document.querySelector('p')!)!;
  info = (await selection.move(info.token, 'right'))!;
  expect(info.url).toContain('/small.png');
  info = (await selection.move(info.token, 'left'))!;
  expect(info.url).toContain('/large.png');
});

test('starts on screen inside the active modal and cancels stale initial discovery', async () => {
  document.body.innerHTML = `<img src="/outside.png"><div role="dialog" aria-modal="true">
    <img id="visible" src="/visible.png"><img id="offscreen" src="/offscreen.png"></div>`;
  vi.mocked(Element.prototype.getBoundingClientRect).mockImplementation(function (this: Element) {
    return new DOMRect(this.id === 'offscreen' ? -1000 : 100, 100, 200, 200);
  });
  const selection = new RelatedImageSelection();
  expect((await selection.start())?.url).toContain('/visible.png');
  document.body.innerHTML = `${'<div></div>'.repeat(200)}<img src="/late.png">`;
  selection.clear();
  const pending = selection.start();
  selection.clear();
  expect(await pending).toBeNull();
});
