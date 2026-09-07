import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import DraggableContainer from './draggable_container.js';
import { MAX_CONTAINER_WIDTH, MIN_CONTAINER_WIDTH } from '../../constants.js';

function renderContainer(width = 420) {
  const updateWidth = vi.fn();
  const updatePosition = vi.fn();
  const view = render(
    <DraggableContainer
      width={width}
      updateWidth={updateWidth}
      position={{ x: 0.5, y: 0.5 }}
      updatePosition={updatePosition}
      containerRef={React.createRef<HTMLDivElement>()}
      searchInputRef={React.createRef<HTMLInputElement>()}
    >
      <div id="keymove-bar" />
    </DraggableContainer>,
  );
  const container = view.container.querySelector<HTMLElement>('#keymove-container')!;
  const handle = view.container.querySelector<HTMLElement>('.keymove-resize-handle')!;
  return { view, container, handle, updateWidth, updatePosition };
}

function drag(handle: HTMLElement, from: number, to: number) {
  fireEvent.mouseDown(handle, { clientX: from });
  fireEvent.mouseMove(document, { clientX: to });
  fireEvent.mouseUp(document);
}

test('widens the bar by the distance the handle was dragged', () => {
  const { container, handle, updateWidth } = renderContainer(420);

  drag(handle, 500, 660);

  expect(container.style.width).toBe('580px');
  expect(updateWidth).toHaveBeenCalledWith(580);
});

test('narrows the bar, and refuses to go below a usable width', () => {
  const { container, handle, updateWidth } = renderContainer(420);

  drag(handle, 500, 100);

  expect(container.style.width).toBe(`${MIN_CONTAINER_WIDTH}px`);
  expect(updateWidth).toHaveBeenCalledWith(MIN_CONTAINER_WIDTH);
});

test('does not grow past the widest usable size', () => {
  const { handle, updateWidth } = renderContainer(420);

  drag(handle, 0, MAX_CONTAINER_WIDTH * 3);

  expect(updateWidth.mock.calls[0]![0]).toBeLessThanOrEqual(MAX_CONTAINER_WIDTH);
});

test('keeps the left edge still while the width changes', () => {
  const { container, handle } = renderContainer(420);
  const leftBefore = container.style.left;

  drag(handle, 500, 620);

  expect(container.style.left).toBe(leftBefore);
});

test('writes the size once on release rather than on every pixel', () => {
  const { handle, updateWidth } = renderContainer(420);

  fireEvent.mouseDown(handle, { clientX: 500 });
  fireEvent.mouseMove(document, { clientX: 520 });
  fireEvent.mouseMove(document, { clientX: 540 });
  fireEvent.mouseMove(document, { clientX: 560 });
  expect(updateWidth).not.toHaveBeenCalled();

  fireEvent.mouseUp(document);
  expect(updateWidth).toHaveBeenCalledTimes(1);
});

test('follows a width changed elsewhere, such as a reset from the popup', () => {
  const { view, container } = renderContainer(420);
  expect(container.style.width).toBe('420px');

  view.rerender(
    <DraggableContainer
      width={300}
      updateWidth={vi.fn()}
      position={{ x: 0.5, y: 0.5 }}
      updatePosition={vi.fn()}
      containerRef={React.createRef<HTMLDivElement>()}
      searchInputRef={React.createRef<HTMLInputElement>()}
    >
      <div id="keymove-bar" />
    </DraggableContainer>,
  );

  expect(container.style.width).toBe('300px');
});
