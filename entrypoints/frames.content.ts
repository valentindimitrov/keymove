import { installFrameWorker } from '../src/lib/frame_worker.js';
import { runSingleContentScript } from '../src/lib/content_script_lifecycle.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_idle',
  noScriptStartedPostMessage: true,
  main(ctx) {
    if (window === window.top) return;
    runSingleContentScript(ctx, 'frames', installFrameWorker);
  },
});
