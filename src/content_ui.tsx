import { createRoot } from 'react-dom/client';
import ExtensionErrorBoundary from './components/extension_error_boundary.js';
import Searchbar from './components/searchbar/searchbar.js';
import { PortalTargetProvider } from './components/searchbar/portal.js';
import createExtensionRoot, { keepExtensionRootConnected } from './lib/create_extension_root.js';
import { reconcileStaleKeyMoveHosts } from './lib/host_marker.js';
import contentStyles from './content.css?inline';

/** Mounts the searchbar; the content script's `mount` callback for runSingleContentScript. */
export default function mountSearch(alive: () => boolean): () => void {
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
}
