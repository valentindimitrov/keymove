import { installFrameWorker } from '../src/lib/frame_worker.js';
import { runSingleContentScript } from '../src/lib/content_script_lifecycle.js';
import { reconcileStaleKeyMoveHosts } from '../src/lib/host_marker.js';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: true,
  matchAboutBlank: true,
  runAt: 'document_idle',
  noScriptStartedPostMessage: true,
  main(ctx) {
    if (window === window.top) return;
    runSingleContentScript(ctx, 'frames', alive => {
      const teardown = installFrameWorker(alive);
      // Remove overlays an earlier copy of the extension left and can no longer remove.
      reconcileStaleKeyMoveHosts(alive);
      return teardown;
    });
  },
});
