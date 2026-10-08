import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Walkthrough from './walkthrough.js';

const createObjectURL = vi.fn(() => 'blob:walkthrough');
const revokeObjectURL = vi.fn();

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise(() => {})),
  );
  vi.stubGlobal('URL', Object.assign(class extends URL {}, { createObjectURL, revokeObjectURL }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it('downloads on request and retains local seeking without HTTP range support', async () => {
  const blob = new Blob(['video'], { type: 'video/mp4' });
  vi.mocked(fetch).mockResolvedValue({ ok: true, blob: async () => blob } as Response);
  const video = setup();
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Play walkthrough' }));
  await waitFor(() => expect(video.getAttribute('src')).toBe('blob:walkthrough'));
  expect(createObjectURL).toHaveBeenCalledWith(blob);
  cleanup();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:walkthrough');
});

it('shows the demo fallback if loading the complete recording fails', async () => {
  vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
  setup();
  fireEvent.click(screen.getByRole('button', { name: 'Play walkthrough' }));
  await waitFor(() =>
    expect(screen.getByRole('status')).toHaveTextContent('The recording could not load'),
  );
});

it('lets timeline scrubbing supersede an unfinished chapter jump', () => {
  const video = setup();
  fireEvent.click(screen.getByRole('button', { name: /Open shortcut help/ }));
  video.currentTime = 3;
  fireEvent.seeking(video);
  fireEvent.seeked(video);
  expect(screen.getByRole('button', { name: /Open and search/ })).toHaveAttribute(
    'aria-current',
    'step',
  );
  expect(screen.getByText(/Just “cof” finds/)).toBeVisible();
});

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
