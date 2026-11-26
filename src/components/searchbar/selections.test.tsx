import { render } from '@testing-library/react';
import Selections from './selections.js';

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
