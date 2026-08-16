import { createRoot } from 'react-dom/client';
import Searchbar from '../src/components/searchbar/searchbar.js';
import createExtensionRoot from '../src/lib/create_extension_root.js';
import contentStyles from '../src/content.css?inline';
import '../src/highlights.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: false,
  runAt: 'document_idle',
  main() {
    const extensionRoot = createExtensionRoot(contentStyles, import.meta.env.BROWSER);

    if (extensionRoot) {
      createRoot(extensionRoot.app).render(<Searchbar />);
    }
  },
});
