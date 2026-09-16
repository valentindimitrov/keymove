import { PageSearchIndex } from './page_search_index.js';
import NodeScorer from './node_scorer.js';
import createExtensionRoot, { keepExtensionRootConnected } from './create_extension_root.js';
import { waitFor } from '@testing-library/react';
import { activeModal } from './modal_context.js';

let index: PageSearchIndex | undefined;
let connection: { disconnect(): void } | undefined;
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(20);
});
afterEach(() => {
  connection?.disconnect();
  index?.disconnect();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

test('limits both navigation modes to a modal and restores them on close', async () => {
  document.body.innerHTML =
    '<p>Save outside <button id="outside">Save</button></p><section role="dialog" aria-modal="true"><button id="inside">Save</button></section>';
  index = new PageSearchIndex();
  let result = await index.search(new NodeScorer('save'));
  expect(result.matchingLinksAndButtons.map(node => node.id)).toEqual(['inside']);
  expect(result.matchingText.map(match => match.node.id)).toEqual(['inside']);
  document.querySelector('section')!.remove();
  await new Promise(resolve => setTimeout(resolve, 0));
  result = await index.search(new NodeScorer('save'));
  expect(result.matchingLinksAndButtons.map(node => node.id)).toEqual(['outside']);
});

test.each([
  '<dialog open>',
  '<section role="dialog">',
  '<section role="dialog" aria-modal="true" hidden>',
])('does not scope search for a nonmodal or hidden dialog: %s', async opening => {
  document.body.innerHTML = `<button id="outside">Save</button>${opening}<button>Save</button>${opening.startsWith('<dialog') ? '</dialog>' : '</section>'}`;
  index = new PageSearchIndex();
  expect((await index.search(new NodeScorer('save'))).matchingLinksAndButtons).toContain(
    document.getElementById('outside'),
  );
});

test('excludes explicitly inert actions and uses the innermost modal', async () => {
  document.body.innerHTML =
    '<div inert><button>Save</button></div><section role="dialog" aria-modal="true"><button>Save</button><section role="alertdialog" aria-modal="true"><button id="inner">Save</button></section></section>';
  index = new PageSearchIndex();
  expect(
    (await index.search(new NodeScorer('save'))).matchingLinksAndButtons.map(node => node.id),
  ).toEqual(['inner']);
  document.querySelectorAll('section').forEach(node => node.removeAttribute('aria-modal'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect((await index.search(new NodeScorer('save'))).matchingLinksAndButtons).toHaveLength(2);
});

test('keeps the same extension UI inside an active modal and returns it after removal', async () => {
  const root = createExtensionRoot('')!;
  connection = keepExtensionRootConnected(root.host);
  document.body.insertAdjacentHTML(
    'beforeend',
    '<section role="dialog" aria-modal="true"></section>',
  );
  const dialog = document.querySelector('section')!;
  await waitFor(() => expect(root.host.parentElement).toBe(dialog));
  dialog.remove();
  await waitFor(() => expect(root.host.parentElement).toBe(document.body));
  expect(root.host.shadowRoot).toBe(root.shadowRoot);
});

test('uses an ARIA confirmation dialog nested within a native modal', () => {
  document.body.innerHTML =
    '<dialog open><section role="alertdialog" aria-modal="true"></section></dialog>';
  const native = document.querySelector('dialog')!;
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
    this: Element,
    selector: string,
  ) {
    return selector === 'dialog:modal' ? this === native : matches.call(this, selector);
  });
  expect(activeModal()).toBe(document.querySelector('section'));
});

test('promotes modal UI to a manual popover and cleans up when the modal closes', async () => {
  const root = createExtensionRoot('')!;
  let open = false;
  const matches = root.host.matches.bind(root.host);
  vi.spyOn(root.host, 'matches').mockImplementation(selector =>
    selector === ':popover-open' ? open : matches(selector),
  );
  root.host.showPopover = vi.fn(() => {
    open = true;
  });
  root.host.hidePopover = vi.fn(() => {
    open = false;
  });
  connection = keepExtensionRootConnected(root.host);
  document.body.insertAdjacentHTML(
    'beforeend',
    '<section role="dialog" aria-modal="true"></section>',
  );
  const dialog = document.querySelector('section')!;
  await waitFor(() => expect(root.host.getAttribute('popover')).toBe('manual'));
  expect(root.host.showPopover).toHaveBeenCalledTimes(1);
  // An ordinary page mutation must not repeatedly hide/show or reorder the overlay.
  dialog.append(document.createElement('p'));
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(root.host.showPopover).toHaveBeenCalledTimes(1);
  dialog.hidden = true;
  await waitFor(() => expect(root.host.parentElement).toBe(document.body));
  expect(root.host.hidePopover).toHaveBeenCalledTimes(1);
  expect(root.host.hasAttribute('popover')).toBe(false);
});
