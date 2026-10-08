import { renderToString } from 'react-dom/server';
import Website from './main.js';
import PatternsPage from './patterns.js';
import GettingStartedPage from './getting-started.js';
import SiteHeader from './site-header.js';
import SiteFooter from './site-footer.js';

export function render() {
  return {
    'index.html': { website: renderToString(<Website />) },
    'patterns.html': { website: renderToString(<PatternsPage />) },
    'getting-started.html': { website: renderToString(<GettingStartedPage />) },
    'privacy-policy.html': {
      'policy-header': renderToString(<SiteHeader patterns />),
      'policy-footer': renderToString(<SiteFooter />),
    },
  };
}
