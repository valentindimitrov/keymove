import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import Walkthrough from './walkthrough.js';

afterEach(cleanup);

function setup(duration = 60) {
  const { container } = render(<Walkthrough />);
  const video = container.querySelector('video')!;
  Object.defineProperty(video, 'duration', { configurable: true, value: duration });
  video.pause = vi.fn();
  return video;
}

it('keeps the latest chapter request until metadata arrives', () => {
  const video = setup(NaN);
  fireEvent.click(screen.getByRole('button', { name: /Find and activate/ }));
  fireEvent.click(screen.getByRole('button', { name: /Open shortcut help/ }));
  expect(screen.getByRole('button', { name: /Open shortcut help/ })).toHaveAttribute(
    'aria-current',
    'step',
  );
  Object.defineProperty(video, 'duration', { value: 60 });
  fireEvent.loadedMetadata(video);
  expect(video.currentTime).toBeCloseTo(38.05);
});

it('does not stop playback when jumping to another chapter', () => {
  const video = setup();
  fireEvent.click(screen.getByRole('button', { name: /Move through the page/ }));
  expect(video.currentTime).toBeGreaterThanOrEqual(6);
  expect(video.pause).not.toHaveBeenCalled();
});

it('does not let stale media events replace the latest chapter selection', () => {
  const video = setup();
  fireEvent.click(screen.getByRole('button', { name: /Move through the page/ }));
  fireEvent.click(screen.getByRole('button', { name: /Open shortcut help/ }));
  const destination = video.currentTime;
  video.currentTime = 6;
  fireEvent.timeUpdate(video);
  fireEvent.seeked(video);
  expect(screen.getByRole('button', { name: /Open shortcut help/ })).toHaveAttribute(
    'aria-current',
    'step',
  );
  video.currentTime = destination;
  fireEvent.seeked(video);
  video.currentTime = 2;
  fireEvent.timeUpdate(video);
  expect(screen.getByRole('button', { name: /Open and search/ })).toHaveAttribute(
    'aria-current',
    'step',
  );
});
