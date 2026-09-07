import { render } from '@testing-library/react';
import Selection from './selection.js';

test('keeps the selected outline inside the viewport on every edge', () => {
  const node = document.createElement('button');
  node.getBoundingClientRect = () =>
    ({
      left: window.innerWidth - 5,
      top: window.innerHeight - 5,
      right: window.innerWidth + 45,
      bottom: window.innerHeight + 45,
      width: 50,
      height: 50,
      x: window.innerWidth - 5,
      y: window.innerHeight - 5,
      toJSON: () => ({}),
    }) satisfies DOMRect;

  const { container } = render(<Selection node={node} isSelected={true} color={'#a78bfa'} />);
  const outline = container.firstElementChild;
  expect(outline).toHaveStyle({
    left: `${window.innerWidth - 12}px`,
    top: `${window.innerHeight - 12}px`,
    width: '12px',
    height: '12px',
  });
});
