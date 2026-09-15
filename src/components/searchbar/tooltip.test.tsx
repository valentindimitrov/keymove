import { render } from '@testing-library/react';
import Tooltip from './tooltip.js';
import { PortalTargetProvider } from './portal.js';

test('keeps an oversized tooltip origin inside a small viewport', () => {
  vi.stubGlobal('innerWidth', 400);
  vi.stubGlobal('innerHeight', 300);
  const anchor = document.createElement('button');
  document.body.append(anchor);
  const bounds = vi
    .spyOn(Element.prototype, 'getBoundingClientRect')
    .mockImplementation(function (this: Element) {
      return this === anchor ? new DOMRect(350, 230, 30, 30) : new DOMRect(0, 0, 545, 420);
    });
  try {
    render(
      <PortalTargetProvider target={document.body}>
        <Tooltip containerRef={{ current: anchor }}>Help</Tooltip>
      </PortalTargetProvider>,
    );
    const panel = document.querySelector<HTMLElement>('.keymove-tooltip-panel')!;
    expect(parseFloat(panel.style.left)).toBeGreaterThanOrEqual(0);
    expect(parseFloat(panel.style.top)).toBeGreaterThanOrEqual(0);
  } finally {
    bounds.mockRestore();
    anchor.remove();
    vi.unstubAllGlobals();
  }
});
