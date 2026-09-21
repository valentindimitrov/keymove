import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import identity from '../src/extension_identity.js';
import logo from '../assets/logo-64.png';
import { LESSONS, type LessonId } from './protocol.js';
import Shortcut from './shortcut.js';
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
    frame.current?.focus();
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
          <a href="#how-it-works">How it works</a>
          <a href={identity.sourceUrl} target="_blank" rel="noreferrer">
            GitHub <span aria-hidden="true">↗</span>
          </a>
          <a className="nav-cta" href="#get-keymove">
            Get KeyMove <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </header>
      <main>
        <section className="hero wrap" aria-labelledby="hero-title">
          <div className="eyebrow">
            <span className="tiny-key" aria-hidden="true">
              K
            </span>{' '}
            YOUR KEYBOARD HAS PLACES TO GO
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
              <a
                className="primary-button"
                href="#playground"
                onClick={() => {
                  if (ready) start('find');
                }}
              >
                Try it below <span aria-hidden="true">↓</span>
              </a>
              <span className="no-install">No installation needed</span>
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
            <p className="muted">From finding something to doing something.</p>
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

        <section className="get-section wrap" id="get-keymove" aria-labelledby="get-title">
          <div>
            <span className="eyebrow">TAKE IT WITH YOU</span>
            <h2 id="get-title">
              Make your next page
              <br />a keyboard-first page.
            </h2>
            <p>
              Built for Chromium browsers and Firefox.
              <br />
              KeyMove is preparing for its first store release.
            </p>
          </div>
          <div className="get-links">
            <a
              className="primary-button"
              href={`${identity.sourceUrl}#readme`}
              target="_blank"
              rel="noreferrer"
            >
              Installation instructions <span aria-hidden="true">↗</span>
            </a>
            <a className="text-link" href={identity.sourceUrl} target="_blank" rel="noreferrer">
              Explore the source on GitHub ↗
            </a>
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
