import ReactDOM from 'react-dom';
import { detect } from 'detect-browser';
import Searchbar from '../src/components/searchbar/searchbar.jsx';
import createExtensionRoot from '../src/lib/create_extension_root.js';
import contentStyles from '../src/content.css?inline';
import '../src/highlights.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  allFrames: false,
  runAt: 'document_idle',
  main() {
    const detectedBrowser = detect();
    const extensionRoot = createExtensionRoot(contentStyles, detectedBrowser?.name);

    if (extensionRoot) {
      ReactDOM.render(<Searchbar />, extensionRoot.app);
    }
  },
});
