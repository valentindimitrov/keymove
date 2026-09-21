import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import identity from '../src/extension_identity.js';
import logo from '../assets/logo-64.png';
import { LESSONS, type LessonId } from './protocol.js';
import Shortcut from './shortcut.js';
import { KEYMOVE_INPUT_ID, KEYMOVE_ROOT_ID } from '../src/constants.js';
import './website.css';

function Website() {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState<LessonId>('find');
  const [started, setStarted] = useState(false);
  const [generation, setGeneration] = useState(0);
  const lesson = LESSONS.find(item => item.id === active) ?? LESSONS[0];

  useEffect(() => {
    const receive = (event: MessageEvent<unknown>) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow)
        return;
      if (event.data === 'keymove-demo:ready') {
        setReady(true);
        setFailed(false);
      }
      if (event.data === 'keymove-demo:exit') document.getElementById('leave-demo')?.focus();
    };
    window.addEventListener('message', receive);
    const timer = window.setTimeout(() => setFailed(true), 15000);
    return () => {
      window.removeEventListener('message', receive);
      window.clearTimeout(timer);
    };
  }, [generation]);

  function start(id: LessonId) {
    setActive(id);
    setStarted(true);
    frame.current?.contentWindow?.postMessage(
      { type: 'keymove-demo:lesson', lesson: id },
      window.location.origin,
    );
    frame.current?.focus({ preventScroll: true });
    const input = frame.current?.contentDocument
      ?.getElementById(KEYMOVE_ROOT_ID)
      ?.shadowRoot?.getElementById(KEYMOVE_INPUT_ID);
    if (frame.current && input) {
      // Bring the actual search field into view, including when the lessons stack
      // above the sample page on a phone.
      window.scrollTo({
        top:
          window.scrollY +
          frame.current.getBoundingClientRect().top +
          input.getBoundingClientRect().top -
          window.innerHeight * 0.4,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      });
    }
  }

  return (
    <>
      <a className="skip-link" href="#playground">
        Skip to playground
      </a>
      <header className="site-header wrap">
        <a className="wordmark" href="#">
          <img src={logo} width="32" height="32" alt="" />
          {identity.name}
        </a>
        <nav aria-label="Main navigation">
          <a className="nav-how" href="#how-it-works">
            How it works
          </a>
          <a className="nav-github" href={identity.sourceUrl} target="_blank" rel="noreferrer">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.65 7.65 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
            </svg>
            GitHub
          </a>
          <div className="store-links" role="group" aria-label="Extension stores">
            {[
              {
                name: 'Chrome',
                store: 'Chrome Web Store',
                url: 'https://chromewebstore.google.com/',
              },
              {
                name: 'Edge',
                store: 'Microsoft Edge Add-ons',
                url: 'https://microsoftedge.microsoft.com/addons/',
              },
              {
                name: 'Firefox',
                store: 'Firefox Add-ons',
                url: 'https://addons.mozilla.org/firefox/',
              },
            ].map(store => (
              <a
                className="store-link"
                key={store.name}
                href={store.url}
                target="_blank"
                rel="noreferrer"
                title={`${store.store} — placeholder until KeyMove is published`}
              >
                {store.name}
              </a>
            ))}
          </div>
        </nav>
      </header>
      <main>
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="eyebrow">
            <span className="tiny-key" aria-hidden="true">
              K
            </span>{' '}
            From finding something to doing something
          </div>
          <div className="hero-row">
            <h1 id="hero-title">
              Find your
              <br />
              <span>next move.</span>
            </h1>
            <div className="hero-copy">
              <p>
                Find the words. Reach the button.
                <br />
                Follow the link. Keep your flow.
              </p>
              <p className="muted">
                KeyMove turns the page into a place
                <br className="desktop-break" /> you can navigate with your keyboard.
              </p>
              <button
                className="primary-button demo-cta"
                type="button"
                disabled={!ready}
                aria-describedby="demo-start-hint"
                onClick={() => start('find')}
              >
                Click to try the demo <span aria-hidden="true">↓</span>
              </button>
              <p className="demo-start-hint" id="demo-start-hint">
                {ready
                  ? 'Start with “coffee” in the highlighted search bar. No installation needed.'
                  : failed
                    ? 'Use Reset demo below to try loading again.'
                    : 'Getting the search bar ready…'}
              </p>
            </div>
          </div>
        </section>

        <section className="playground wrap" id="playground" aria-labelledby="playground-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">THE PLAYGROUND</span>
              <h2 id="playground-title">A little less mouse. A lot more momentum.</h2>
            </div>
            <span className="demo-label">Live demo · Real KeyMove</span>
          </div>
          <div className="playground-layout">
            <aside className="lesson-panel" aria-label="Try these features">
              <p className="lesson-intro">Three moves to get the feeling.</p>
              <div className="lessons">
                {LESSONS.map(item => (
                  <button
                    className={`lesson ${active === item.id ? 'selected' : ''}`}
                    key={item.id}
                    type="button"
                    aria-pressed={active === item.id}
                    disabled={!ready}
                    onClick={() => start(item.id)}
                  >
                    <span className="lesson-number">{item.number}</span>
                    <span>
                      <strong>{item.title}</strong>
                      <span className="lesson-query">Try “{item.query}”</span>
                    </span>
                    <span className="lesson-arrow" aria-hidden="true">
                      ↗
                    </span>
                  </button>
                ))}
              </div>
              <div className="lesson-instructions" aria-live="polite">
                <span className="eyebrow">{started ? 'YOUR NEXT MOVE' : 'START HERE'}</span>
                <p>
                  {started
                    ? lesson.hint
                    : 'Choose a move above, or click the searchbar in the sample page and type something you see.'}
                </p>
              </div>
              <div className="escape-note">
                <Shortcut name="dismiss_search" />
                <span>Clear the search. Press again to leave the demo.</span>
              </div>
            </aside>
            <div className="browser-frame">
              <div className="browser-toolbar">
                <div className="window-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <span>the small hours / weekend guide</span>
                <button
                  type="button"
                  onClick={() => {
                    setReady(false);
                    setFailed(false);
                    setStarted(false);
                    setActive('find');
                    setGeneration(value => value + 1);
                  }}
                >
                  Reset demo <span aria-hidden="true">↻</span>
                </button>
              </div>
              {!ready && (
                <div className="demo-loading" role="status">
                  {failed
                    ? 'The demo could not load. Use Reset demo to try again.'
                    : 'Getting the playground ready…'}
                </div>
              )}
              <iframe
                key={generation}
                ref={frame}
                src="./demo.html"
                title="Interactive KeyMove demo on a sample weekend guide"
                allow="clipboard-write"
                onError={() => setFailed(true)}
              />
              <div className="browser-footer">
                <span>
                  <Shortcut name="next_match" /> Next text match
                </span>
                <span>
                  <Shortcut name="select_match" /> Activate
                </span>
                <span>
                  <Shortcut name="open_action_menu" /> Actions
                </span>
              </div>
            </div>
          </div>
          <p className="playground-note" id="leave-demo" tabIndex={-1}>
            This demo searches only the sample page. Install KeyMove to bring it to the pages you
            browse. New-tab actions require the extension.
          </p>
        </section>

        <section className="how-section wrap" id="how-it-works" aria-labelledby="how-title">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SMALL SHORTCUTS. BIG DIFFERENCE.</span>
              <h2 id="how-title">Stay with the thought.</h2>
            </div>
          </div>
          <div className="features">
            <article>
              <span className="feature-key">
                <Shortcut name="next_match" />
              </span>
              <h3>More than a highlight.</h3>
              <p>
                Move through complete text blocks. Copy the selected passage with{' '}
                <Shortcut name="copy_selected_link" />, without dragging across the page.
              </p>
            </article>
            <article>
              <span className="feature-key">
                <Shortcut name="toggle_search_mode" />
              </span>
              <h3>Words or actions. Your call.</h3>
              <p>
                Switch between text and interactive controls. Find a link, button, or input by its
                name.
              </p>
            </article>
            <article>
              <span className="feature-key">
                <Shortcut name="open_action_menu" />
              </span>
              <h3>Your next step is right there.</h3>
              <p>
                Open the selected result’s action menu. Follow a link, copy its address, or focus a
                control.
              </p>
            </article>
          </div>
        </section>
      </main>
      <footer className="site-footer wrap">
        <a className="wordmark" href="#">
          <img src={logo} width="26" height="26" alt="" />
          {identity.name}
        </a>
        <span>A keyboard-first way through the web. Powered by Comake.</span>
        <a href="./LICENSE.txt">License & attribution</a>
      </footer>
    </>
  );
}

const mount = document.getElementById('website');
if (mount) createRoot(mount).render(<Website />);
