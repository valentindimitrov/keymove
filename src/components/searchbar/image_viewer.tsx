import React from 'react';
import Portal from './portal.js';
import type { ImageInfo } from '../../lib/image_schema.js';

export default function ImageViewer({
  image,
  onClose,
  input,
}: {
  image: ImageInfo;
  onClose: () => void;
  input: React.RefObject<HTMLInputElement | null>;
}) {
  const close = React.useRef<HTMLButtonElement>(null);
  const dialog = React.useRef<HTMLDivElement>(null);
  const [failed, setFailed] = React.useState(false);
  React.useLayoutEffect(() => {
    close.current?.focus({ preventScroll: true });
    const search = input.current;
    const container = dialog.current;
    return () => {
      const tree = container?.getRootNode();
      const active = tree instanceof ShadowRoot ? tree.activeElement : document.activeElement;
      if (active && container?.contains(active)) search?.focus({ preventScroll: true });
    };
  }, [input]);
  return (
    <Portal>
      <div
        ref={dialog}
        className="keymove-image-viewer"
        role="dialog"
        aria-modal="true"
        aria-label="Image viewer"
        onKeyDown={event => {
          event.stopPropagation();
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
          if (event.key === 'Tab') {
            event.preventDefault();
            close.current?.focus();
          }
          if (
            [
              'ArrowUp',
              'ArrowDown',
              'ArrowLeft',
              'ArrowRight',
              'PageUp',
              'PageDown',
              'Home',
              'End',
            ].includes(event.key)
          )
            event.preventDefault();
        }}
        onKeyUp={event => event.stopPropagation()}
        onClick={event => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <button type="button" ref={close} onClick={onClose}>
          Close image (Esc)
        </button>
        {failed ? (
          <p role="alert">This image could not be displayed. Try opening it in a new tab.</p>
        ) : (
          <img
            src={image.url}
            alt={image.label}
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
          />
        )}
        <p>{image.label}</p>
      </div>
    </Portal>
  );
}
