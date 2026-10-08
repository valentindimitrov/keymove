import SiteHeader from './site-header.js';
import SiteFooter from './site-footer.js';
import Shortcut from './shortcut.js';
import './website.css';
import './getting-started.css';

export default function GettingStartedPage() {
  return (
    <>
      <a className="skip-link" href="#getting-started">
        Skip to the guide
      </a>
      <SiteHeader patterns />
      <main className="guide-page wrap" id="getting-started">
        <div className="guide-intro">
          <h1>Get started with KeyMove</h1>
          <p>Find text, follow links, and activate controls without leaving your keyboard.</p>
          <a href="./#playground">Try the interactive demo first</a>
        </div>
        <nav className="guide-index" aria-label="Guide sections">
          <a href="#install">Install</a>
          <a href="#first-action">Your first action</a>
          <a href="#shortcuts">Shortcuts</a>
          <a href="#limitations">Where it works</a>
          <a href="#privacy">Privacy</a>
        </nav>
        <section id="install" aria-labelledby="install-title">
          <h2 id="install-title">1. Install the extension</h2>
          <p>Choose your browser’s store, then confirm installation in your browser.</p>
          <ul className="guide-stores">
            <li>
              <a
                href="https://chromewebstore.google.com/detail/keymove/kllljoldaaendmbegkmkjccadcljpnhj"
                target="_blank"
                rel="noreferrer"
              >
                Install for Chrome or Vivaldi
              </a>
              <span>Chrome Web Store</span>
            </li>
            <li>
              <a
                href="https://addons.mozilla.org/firefox/addon/keymove/"
                target="_blank"
                rel="noreferrer"
              >
                Install for Firefox
              </a>
              <span>Firefox Add-ons</span>
            </li>
          </ul>
          <p>Pin KeyMove to your browser toolbar for easy access to its settings.</p>
        </section>
        <section id="first-action" aria-labelledby="first-action-title">
          <h2 id="first-action-title">2. Make your first move</h2>
          <ol className="guide-steps">
            <li>Open a normal web page, such as an article or a shopping page.</li>
            <li>
              Press <Shortcut name="focus_searchbar" /> to focus KeyMove’s search bar. This is the
              default opening shortcut; you can change it in settings.
            </li>
            <li>
              Type a word you can see on the page. KeyMove selects the first match automatically.
            </li>
            <li>
              Press <Shortcut name="next_match" /> to move to the next match, or{' '}
              <Shortcut name="previous_match" /> to go back.
            </li>
            <li>
              If the selected text has a link, button, or other action attached, press{' '}
              <Shortcut name="select_match" /> to activate it. Otherwise, Enter leaves the text
              selected.
            </li>
          </ol>
          <p>
            For example, search for a link’s visible words, then press Enter to follow it.{' '}
            <a href="./patterns#follow-a-link">Watch the link example</a>.
          </p>
          <p>
            Press <Shortcut name="dismiss_search" /> to close KeyMove and stay where you are.
          </p>
          <noscript>
            <p>
              On macOS, use Option in place of Alt for the shortcuts in this guide, and Command
              instead of Control for copying.
            </p>
          </noscript>
        </section>
        <section id="shortcuts" aria-labelledby="shortcuts-title">
          <h2 id="shortcuts-title">3. Choose text or actions</h2>
          <p>
            Text mode selects complete passages, so you can read or copy the whole block. Action
            mode focuses your search on links, buttons, and form controls. Each mode remembers its
            own position.
          </p>
          <dl className="guide-shortcuts">
            <div>
              <dt>
                <Shortcut name="toggle_search_mode" />
              </dt>
              <dd>Switch between text and action mode.</dd>
            </div>
            <div>
              <dt>
                <Shortcut name="next_match" />
              </dt>
              <dd>Move to the next match in the current mode.</dd>
            </div>
            <div>
              <dt>
                <Shortcut name="copy_selected_link" />
              </dt>
              <dd>
                Copy the selected passage in text mode, or the selected link’s URL in action mode.
              </dd>
            </div>
            <div>
              <dt>
                <Shortcut name="open_action_menu" />
              </dt>
              <dd>Open the selected result’s action menu while the search input is focused.</dd>
            </div>
          </dl>
          <p>
            In the action menu, use Up and Down to choose an action, then Enter to run it. Left or
            Escape returns to your search. The available actions depend on the selected result.
          </p>
          <p>
            <a href="./patterns#choose-an-action">Watch the action menu</a> or{' '}
            <a href="./patterns#copy-a-passage">see how copying a passage works</a>.
          </p>
        </section>
        <section aria-labelledby="find-title">
          <h2 id="find-title">How is this different from Ctrl+F?</h2>
          <p>
            Ctrl+F helps you locate text. KeyMove also lets you select complete passages and act on
            matching links, buttons, and form controls from the keyboard.
          </p>
          <p>
            Search for the visible text beside a checkbox, for example, then activate the associated
            control. <a href="./patterns#act-through-text">See the labelled-control example</a>.
          </p>
        </section>
        <section id="limitations" aria-labelledby="limitations-title">
          <h2 id="limitations-title">Where it works, and what to expect</h2>
          <ul>
            <li>
              Browser settings, extension stores, and other protected pages may block extensions.
              Try a normal website if KeyMove does not open.
            </li>
            <li>
              Browsers may reserve shortcuts such as Control + Tab. Switch modes with{' '}
              <Shortcut name="toggle_search_mode" />, then use Tab to navigate.
            </li>
            <li>
              Typing in a page’s input field stays with that field. Use the opening shortcut when
              you want to search instead.
            </li>
            <li>
              If a site is paused in KeyMove’s settings, resume it there before searching. You can
              also customize activation for individual sites.
            </li>
            <li>
              Some menus respond to KeyMove’s selection hover. Menus that require real pointer
              movement or CSS-only hover may not open.
            </li>
          </ul>
          <p>
            The <a href="./#playground">interactive demo</a> searches only its sample page. Install
            the extension to use KeyMove across the pages you browse, including its new-tab actions.
          </p>
        </section>
        <section id="privacy" aria-labelledby="privacy-title">
          <h2 id="privacy-title">Your searches stay in your browser</h2>
          <p>
            KeyMove processes page content locally to find matches. Extension preferences are saved
            in your browser’s local extension storage. No account is required.
          </p>
          <p>
            Read the <a href="./privacy-policy">privacy policy</a> for details, or explore the{' '}
            <a href="./patterns">navigation patterns</a> to see more ways to move around a page.
          </p>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
