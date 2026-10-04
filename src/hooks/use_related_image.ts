import React from 'react';
import { RelatedImageSelection } from '../lib/related_images.js';
import { frameTarget, resultIsConnected } from '../lib/frame_target.js';
import { isImageInfo } from '../lib/image_schema.js';
import type { ImageDirection, ImageInfo, ImageOperation } from '../lib/image_schema.js';
import { activeModal, actionIsInScope } from '../lib/modal_context.js';
import { isTextVisible } from '../lib/visible_text.js';
import Utils from '../lib/utils.js';

export default function useRelatedImage(source: Element | null, query: string, enabled: boolean) {
  const [selection] = React.useState(() => new RelatedImageSelection());
  const [image, setImage] = React.useState<ImageInfo | null>(null);
  const [viewer, setViewer] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const owner = React.useRef<Element | null>(null);
  const current = React.useRef<ImageInfo | null>(null);
  const revision = React.useRef(0);
  const busy = React.useRef(false);
  const clear = React.useCallback(() => {
    revision.current++;
    if (owner.current)
      void frameTarget(owner.current)?.command({
        image: 'clear',
        token: current.current?.token ?? '',
      });
    owner.current = null;
    current.current = null;
    selection.clear();
    setImage(null);
    setViewer(false);
    setMessage('');
  }, [selection]);
  React.useEffect(() => {
    clear();
    return clear;
  }, [source, query, enabled, clear]);

  const command = React.useCallback(
    async (operation: ImageOperation) => {
      const target = owner.current;
      const info = current.current;
      if (
        !target ||
        !info ||
        !resultIsConnected(target) ||
        !isTextVisible(target) ||
        !actionIsInScope(target, activeModal())
      )
        return null;
      const remote = frameTarget(target);
      if (remote) {
        const reply = await remote.command({ image: operation, token: info.token });
        return current.current === info ? reply : null;
      }
      if (operation === 'info') return selection.info(info.token);
      if (operation === 'activate') return selection.activate(info.token);
      if (operation === 'copy') {
        await selection.copy(info.token);
        return true;
      }
      return null;
    },
    [selection],
  );
  const next = React.useCallback(
    async (direction?: ImageDirection) => {
      if (!enabled || (source && !resultIsConnected(source)) || busy.current) return;
      if (direction && !current.current) return;
      busy.current = true;
      const version = revision.current;
      owner.current = source ?? owner.current;
      try {
        const remote = frameTarget(source);
        const info = remote
          ? await remote.command({
              image: direction ?? 'next',
              token: current.current?.token ?? '',
            })
          : direction
            ? await selection.move(current.current!.token, direction)
            : source
              ? selection.next(source)
              : await selection.start();
        if (version !== revision.current) {
          if (remote && isImageInfo(info))
            void remote.command({ image: 'clear', token: info.token });
          return;
        }
        if (!isImageInfo(info)) {
          clear();
          setMessage('No related image found.');
          return;
        }
        current.current = info;
        owner.current = source ?? selection.source;
        setImage(info);
        setMessage('');
        Utils.clearPageSelection();
        if (selection.node) Utils.scrollToNodeAtIndexInList([selection.node], 0);
      } catch {
        if (version === revision.current) {
          clear();
          setMessage('Could not select this image.');
        }
      } finally {
        busy.current = false;
      }
    },
    [enabled, source, selection, clear],
  );
  React.useEffect(() => {
    if (!image) return undefined;
    let stopped = false;
    let pending = false;
    const timer = window.setInterval(() => {
      if (pending || busy.current) return;
      pending = true;
      const version = revision.current;
      void command('info')
        .then(info => {
          if (!stopped && !busy.current && version === revision.current && !isImageInfo(info))
            clear();
        })
        .catch(() => {
          if (!stopped && version === revision.current) clear();
        })
        .finally(() => {
          pending = false;
        });
    }, 250);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [image, command, clear]);
  return {
    image,
    owner: image ? owner.current : null,
    node: image ? selection.node : null,
    viewer,
    setViewer,
    message,
    clear,
    next,
    command,
  };
}
