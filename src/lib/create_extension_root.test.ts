import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import Portal, { PortalTargetProvider } from '../components/searchbar/portal.js';
import createExtensionRoot from './create_extension_root.js';
import { keepExtensionRootConnected } from './create_extension_root.js';
import { KEYMOVE_APP_ID, KEYMOVE_PORTAL_ID, KEYMOVE_ROOT_ID } from '../constants.js';

afterEach(() => {
  document.body.innerHTML = '';
});

test('mounts styles and UI targets inside an isolated shadow root', () => {
  const result = createExtensionRoot(':host { color: red; }', 'firefox');
  expect(result).not.toBeNull();
  if (!result) {
    throw new Error('Expected the extension root to be created.');
  }

  expect(result.host.id).toBe(KEYMOVE_ROOT_ID);
  expect(result.host.classList.contains('keymove-firefox')).toBe(true);
  expect(result.shadowRoot.querySelector('style')?.textContent).toContain('color: red');
  expect(result.shadowRoot.getElementById(KEYMOVE_APP_ID)).toBe(result.app);
  expect(result.shadowRoot.getElementById(KEYMOVE_PORTAL_ID)).toBe(result.portal);
  expect(document.getElementById(KEYMOVE_APP_ID)).toBeNull();
});

test('does not mount the extension twice', () => {
  createExtensionRoot('', 'chrome');
  expect(createExtensionRoot('', 'chrome')).toBeNull();
  expect(document.querySelectorAll(`#${KEYMOVE_ROOT_ID}`)).toHaveLength(1);
});

test('keeps interface clicks inside the shadow host while page activation still bubbles', () => {
  const root = createExtensionRoot('')!;
  const pageButton = document.createElement('button');
  document.body.append(pageButton);
  const pageClick = vi.fn();
  const interfaceClick = vi.fn();
  document.onclick = pageClick;
  const view = render(
    React.createElement(
      PortalTargetProvider,
      { target: root.portal },
      React.createElement('button', { onClick: interfaceClick }, 'Interface'),
      React.createElement(
        Portal,
        null,
        React.createElement('button', { onClick: () => pageButton.click() }, 'Activate page'),
      ),
    ),
    { container: root.app },
  );
  try {
    expect(fireEvent.click(root.app.querySelector('button')!, { composed: true })).toBe(true);
    expect(interfaceClick).toHaveBeenCalledOnce();
    expect(pageClick).not.toHaveBeenCalled();
    fireEvent.click(root.portal.querySelector('button')!, { composed: true });
    expect(pageClick).toHaveBeenCalledOnce();
    expect(pageClick.mock.calls[0]![0].target).toBe(pageButton);
  } finally {
    document.onclick = null;
    view.unmount();
  }
});

test('reattaches the same shadow root and portal target after document.body is replaced', async () => {
  const result = createExtensionRoot('', 'chrome');
  if (!result) {
    throw new Error('Expected the extension root to be created.');
  }
  const observer = keepExtensionRootConnected(result.host);
  const view = render(
    React.createElement(
      PortalTargetProvider,
      { target: result.portal },
      React.createElement(Portal, null, React.createElement('span', null, 'Portal content')),
    ),
    { container: result.app },
  );
  expect(result.portal).toHaveTextContent('Portal content');

  const replacementBody = document.createElement('body');
  document.documentElement.replaceChild(replacementBody, document.body);

  await waitFor(() => expect(result.host.parentElement).toBe(replacementBody));
  expect(result.host.shadowRoot).toBe(result.shadowRoot);
  expect(result.portal).toHaveTextContent('Portal content');

  observer.disconnect();
  view.unmount();
});

test('renders nothing instead of throwing when no portal provider exists', () => {
  expect(() => render(React.createElement(Portal, null, 'Unavailable portal'))).not.toThrow();
  expect(document.body).not.toHaveTextContent('Unavailable portal');
});
