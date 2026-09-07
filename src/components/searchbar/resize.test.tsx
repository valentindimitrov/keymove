import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import DraggableContainer from './draggable_container.js';
import { MAX_CONTAINER_WIDTH, MIN_CONTAINER_WIDTH } from '../../constants.js';

function renderContainer(width = 420, position = { x: 0.5, y: 0.5 }) {
  const updateWidth = vi.fn();
  const updatePosition = vi.fn();
  const view = render(
    <DraggableContainer
      width={width}
      updateWidth={updateWidth}
      position={position}
      updatePosition={updatePosition}
      containerRef={React.createRef<HTMLDivElement>()}
      searchInputRef={React.createRef<HTMLInputElement>()}
    >
      <div id="keymove-bar" />
    </DraggableContainer>,
  );
  const container = view.container.querySelector<HTMLElement>('#keymove-container')!;
  const handle = view.container.querySelector<HTMLElement>('.keymove-resize-handle-right')!;
  const leftHandle = view.container.querySelector<HTMLElement>('.keymove-resize-handle-left')!;
  return { view, container, handle, leftHandle, updateWidth, updatePosition };
}

function drag(handle: HTMLElement, from: number, to: number) {
  fireEvent.mouseDown(handle, { clientX: from });
  fireEvent.mouseMove(document, { clientX: to });
  fireEvent.mouseUp(document);
}

// The pointer moves one edge, both edges move, so the width gains twice the distance dragged.
test('widens the bar by twice the distance the handle was dragged', () => {
  const { container, handle, updateWidth } = renderContainer(420);

  drag(handle, 500, 660);

  expect(container.style.width).toBe('740px');
  expect(updateWidth).toHaveBeenCalledWith(740);
});

test('widens the bar the same way from the left handle', () => {
  const { container, leftHandle, updateWidth } = renderContainer(420);

  drag(leftHandle, 500, 340);

  expect(container.style.width).toBe('740px');
  expect(updateWidth).toHaveBeenCalledWith(740);
});

test('narrows the bar from the left handle', () => {
  const { container, leftHandle } = renderContainer(420);

  drag(leftHandle, 500, 560);

  expect(container.style.width).toBe('300px');
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

test('keeps the centre still, moving both edges by the same amount', () => {
  const { container, handle } = renderContainer(420);
  const widthBefore = Number.parseFloat(container.style.width);
  const leftBefore = Number.parseFloat(container.style.left);
  const centerBefore = leftBefore + widthBefore / 2;

  drag(handle, 500, 620);

  const widthAfter = Number.parseFloat(container.style.width);
  const leftAfter = Number.parseFloat(container.style.left);
  expect(widthAfter).toBe(widthBefore + 240);
  expect(leftAfter).toBe(leftBefore - 120);
  expect(leftAfter + widthAfter / 2).toBe(centerBefore);
});

// Symmetric growth runs out of room at the nearer edge, on whichever side it is.
test('stops growing when the nearer viewport edge is reached', () => {
  const { container, handle } = renderContainer(420, { x: 0.3, y: 0.5 });

  drag(handle, 500, 5000);

  const left = Number.parseFloat(container.style.left);
  const width = Number.parseFloat(container.style.width);
  // Not exactly zero: the width is rounded to whole pixels, so half a rounded-off pixel
  // is left on each side.
  expect(left).toBeCloseTo(0, 0);
  expect(left + width).toBeLessThanOrEqual(window.innerWidth);
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
