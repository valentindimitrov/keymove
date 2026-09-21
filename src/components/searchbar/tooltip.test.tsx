import { render } from '@testing-library/react';
import { createRef } from 'react';
import Tooltip from './tooltip.js';
import { PortalTargetProvider } from './portal.js';

afterEach(() => vi.restoreAllMocks());

test.each([
  { triggerTop: 480, panelHeight: 600, side: 'above' },
  { triggerTop: 80, panelHeight: 600, side: 'below' },
  { triggerTop: 480, panelHeight: 100, side: 'below' },
])(
  'keeps a $panelHeight px panel $side the trigger at $triggerTop',
  ({ triggerTop, panelHeight, side }) => {
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(670);
    const trigger = document.createElement('button');
    trigger.getBoundingClientRect = () =>
      ({ top: triggerTop, bottom: triggerTop + 30, left: 500, width: 30, height: 30 }) as DOMRect;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      height: panelHeight,
      width: 545,
    } as DOMRect);
    const ref = createRef<HTMLElement>();
    ref.current = trigger;
    render(
      <PortalTargetProvider target={document.body}>
        <Tooltip containerRef={ref}>Shortcuts</Tooltip>
      </PortalTargetProvider>,
    );
    const panel = document.querySelector<HTMLElement>('.keymove-tooltip-panel')!;
    const top = Number.parseFloat(panel.style.top);
    const height = Math.min(panelHeight, Number.parseFloat(panel.style.maxHeight) || panelHeight);

    if (side === 'above') expect(top + height).toBeLessThanOrEqual(triggerTop - 15);
    else expect(top).toBeGreaterThanOrEqual(triggerTop + 45);
    expect(top).toBeGreaterThanOrEqual(8);
    expect(top + height).toBeLessThanOrEqual(662);
  },
);

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
