import { createRoot } from 'react-dom/client';
import ExtensionErrorBoundary from '../src/components/extension_error_boundary.js';
import Searchbar from '../src/components/searchbar/searchbar.js';
import { PortalTargetProvider } from '../src/components/searchbar/portal.js';
import createExtensionRoot, {
  keepExtensionRootConnected,
} from '../src/lib/create_extension_root.js';
import { runSingleContentScript } from '../src/lib/content_script_lifecycle.js';
import { reconcileStaleKeyMoveHosts } from '../src/lib/host_marker.js';
import contentStyles from '../src/content.css?inline';
import '../src/highlights.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: false,
  runAt: 'document_idle',
  // The started event is still dispatched on the document, but page script need not
  // be told its type. KeyMove does not trust it either way: see content_script_lifecycle.
  noScriptStartedPostMessage: true,
  main(ctx) {
    runSingleContentScript(ctx, 'content', alive => {
      const extensionRoot = createExtensionRoot(contentStyles, import.meta.env.BROWSER);
      const observer = keepExtensionRootConnected(extensionRoot.host, alive);
      // Remove hosts an earlier copy of the extension left and can no longer remove.
      reconcileStaleKeyMoveHosts(alive);
      const root = createRoot(extensionRoot.app);
      root.render(
        <PortalTargetProvider target={extensionRoot.portal}>
          <ExtensionErrorBoundary>
            <Searchbar />
          </ExtensionErrorBoundary>
        </PortalTargetProvider>,
      );
      return () => {
        observer.disconnect();
        root.unmount();
        extensionRoot.host.remove();
      };
    });
  },
});
