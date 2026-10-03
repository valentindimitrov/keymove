import { createRoot } from 'react-dom/client';
import SiteHeader from './site-header.js';
import SiteFooter from './site-footer.js';

const header = document.getElementById('policy-header');
const footer = document.getElementById('policy-footer');
if (header) createRoot(header).render(<SiteHeader patterns />);
if (footer) createRoot(footer).render(<SiteFooter />);
