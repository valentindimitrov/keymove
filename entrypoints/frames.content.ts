import { installFrameWorker } from '../src/lib/frame_worker.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_idle',
  main(ctx) {
    if (window === window.top) return;
    ctx.onInvalidated(installFrameWorker());
  },
});
