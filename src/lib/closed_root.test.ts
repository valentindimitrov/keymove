// Shipped builds close KeyMove's shadow roots; tests otherwise run with them open.
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  document.body.replaceChildren();
});

async function productionModules() {
  vi.stubEnv('MODE', 'production');
  vi.stubEnv('DEV', false);
  vi.resetModules();
  const [{ default: createExtensionRoot }, { default: Utils }, { activeModal }] = await Promise.all(
    [import('./create_extension_root.js'), import('./utils.js'), import('./modal_context.js')],
  );
  return { createExtensionRoot, Utils, activeModal };
}

test('shipped builds close the root to page script, but KeyMove still tracks its own focus', async () => {
  const { createExtensionRoot, Utils, activeModal } = await productionModules();
  const { host, shadowRoot, app } = createExtensionRoot('', 'chrome');
  // What page script sees: no root to read results from or to drive the input through.
  expect(host.shadowRoot).toBeNull();
  expect(shadowRoot.mode).toBe('closed');

  const input = document.createElement('input');
  app.append(input);
  input.focus();
  expect(document.activeElement).toBe(host);
  // Without any extension accessor, as Safari may be, KeyMove finds its own input.
  expect(Utils.elementIsActive(input)).toBe(true);
  expect(Utils.differentInputIsActive(input)).toBe(false);
  expect(activeModal()).toBeNull();

  // A document listener sees the host as the target; KeyMove resolves the input inside.
  let resolved: EventTarget | null = null;
  const listener = (event: KeyboardEvent) => {
    resolved = Utils.focusedEventTarget(event);
  };
  document.addEventListener('keydown', listener, true);
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, composed: true }));
  document.removeEventListener('keydown', listener, true);
  expect(resolved).toBe(input);
});
