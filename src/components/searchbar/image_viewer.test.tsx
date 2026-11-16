import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import ImageViewer from './image_viewer.js';
import { PortalTargetProvider } from './portal.js';
import { acceptSyntheticInputForTesting } from '../../lib/trusted_input.js';

const image = {
  token: 'token',
  url: 'https://example.com/photo.png',
  label: 'Product photo',
  link: null,
  position: 1,
  count: 1,
};

function renderViewer() {
  const onClose = vi.fn();
  const input = React.createRef<HTMLInputElement>();
  const target = document.createElement('div');
  document.body.append(target);
  render(
    <PortalTargetProvider target={target}>
      <input ref={input} aria-label="Search page" />
      <ImageViewer image={image} onClose={onClose} input={input} />
    </PortalTargetProvider>,
  );
  const dialog = screen.getByRole('dialog', { name: 'Image viewer' });
  const close = screen.getByRole('button', { name: 'Close image (Esc)' });
  return { onClose, dialog, close };
}

afterEach(() => {
  acceptSyntheticInputForTesting(true);
  document.body.innerHTML = '';
});

test('closes from Escape, the Close button and the backdrop', () => {
  const { onClose, dialog, close } = renderViewer();
  expect(close).toHaveFocus();
  fireEvent.keyDown(dialog, { key: 'Escape' });
  fireEvent.click(close);
  fireEvent.click(dialog);
  expect(onClose).toHaveBeenCalledTimes(3);
});

test('page-dispatched events cannot close the viewer or move its focus', () => {
  const { onClose, dialog, close } = renderViewer();
  const outside = document.createElement('button');
  document.body.append(outside);
  acceptSyntheticInputForTesting(false);

  fireEvent.keyDown(dialog, { key: 'Escape' });
  close.click();
  fireEvent.click(dialog);
  outside.focus();
  fireEvent.keyDown(dialog, { key: 'Tab' });
  expect(onClose).not.toHaveBeenCalled();
  expect(outside).toHaveFocus();
});
