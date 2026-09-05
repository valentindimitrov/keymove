import { createRoot } from 'react-dom/client';
import ExtensionErrorBoundary from '../src/components/extension_error_boundary.js';
import Searchbar from '../src/components/searchbar/searchbar.js';
import { PortalTargetProvider } from '../src/components/searchbar/portal.js';
import createExtensionRoot, {
  keepExtensionRootConnected,
} from '../src/lib/create_extension_root.js';
import contentStyles from '../src/content.css?inline';
import '../src/highlights.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: false,
  runAt: 'document_idle',
  main() {
    const extensionRoot = createExtensionRoot(contentStyles, import.meta.env.BROWSER);

    if (extensionRoot) {
      keepExtensionRootConnected(extensionRoot.host);
      createRoot(extensionRoot.app).render(
        <PortalTargetProvider target={extensionRoot.portal}>
          <ExtensionErrorBoundary>
            <Searchbar />
          </ExtensionErrorBoundary>
        </PortalTargetProvider>,
      );
    }
  },
});
