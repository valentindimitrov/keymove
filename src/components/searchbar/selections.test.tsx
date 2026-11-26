import { render } from '@testing-library/react';
import Selections from './selections.js';
import { setFrameTarget } from '../../lib/frame_target.js';

test('outlines only matches on or near the screen, and always the selected one', () => {
  const nodes = [0, 400, 20000, 30000].map(top => {
    const node = document.createElement('p');
    document.body.append(node);
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(new DOMRect(10, top, 200, 20));
    return node;
  });
  const { container } = render(
    <Selections
      selectedSelectionIndex={3}
      matchingNodes={nodes}
      refresh={false}
      color="#f59e0b"
      showOtherMatches
    />,
  );
  const outlines = [...container.querySelectorAll<HTMLElement>('.keymove-selection')];
  expect(outlines.map(outline => outline.classList.contains('keymove-selected-selection'))).toEqual(
    [false, false, true],
  );
  document.body.replaceChildren();
});

test('repaints frames when their matches change, not on every outline refresh', () => {
  const boundary = document.createElement('iframe');
  document.body.append(boundary);
  const paint = vi.fn();
  const node = document.createElement('p');
  setFrameTarget(node, {
    boundary,
    alive: () => true,
    command: vi.fn(),
    paint,
    row: {
      id: 1,
      kind: 'text',
      action: null,
      label: 'Quokka',
      text: 'Quokka',
      context: '',
      href: null,
      disabled: false,
      focusable: false,
      score: 1,
      term: null,
      distance: null,
    },
  });
  const props = { selectedSelectionIndex: 0, color: '#f59e0b', showOtherMatches: true };
  const matchingNodes = [node];
  const { rerender } = render(
    <Selections {...props} matchingNodes={matchingNodes} refresh={false} />,
  );
  expect(paint).toHaveBeenCalledTimes(1);
  rerender(<Selections {...props} matchingNodes={matchingNodes} refresh={true} />);
  expect(paint).toHaveBeenCalledTimes(1);
  // New matches repaint; the cleanup's clear is cancelled by that repaint in the same flush.
  rerender(<Selections {...props} matchingNodes={[node]} refresh={true} />);
  expect(paint).toHaveBeenCalledTimes(2);
  document.body.replaceChildren();
});
