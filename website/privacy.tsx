import { mountPage } from './mount-page.js';
import SiteHeader from './site-header.js';
import SiteFooter from './site-footer.js';

mountPage('policy-header', <SiteHeader patterns />);
mountPage('policy-footer', <SiteFooter />);
