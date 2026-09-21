import identity from '../src/extension_identity.js';
import logo from '../assets/logo-64.png';

export default function SiteFooter() {
  return (
    <footer className="site-footer wrap">
      <a className="wordmark" href="./">
        <img src={logo} width="26" height="26" alt="" />
        {identity.name}
      </a>
      <span>A browser extension for in-page keyboard navigation. Powered by Comake.</span>
      <a href="./LICENSE.txt">License &amp; attribution</a>
      <a href="./patterns.html">Navigation patterns</a>
    </footer>
  );
}
