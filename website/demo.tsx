import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Searchbar from '../src/components/searchbar/searchbar.js';
import ExtensionErrorBoundary from '../src/components/extension_error_boundary.js';
import { PortalTargetProvider } from '../src/components/searchbar/portal.js';
import { PopupSettingsView } from '../src/components/popup/popup_settings.js';
import useStoredSettings from '../src/hooks/use_stored_settings.js';
import useInteractionSettings from '../src/hooks/use_interaction_settings.js';
import useHighlightColors from '../src/hooks/use_highlight_colors.js';
import usePopupPosition from '../src/hooks/use_popup_position.js';
import usePopupWidth from '../src/hooks/use_popup_width.js';
import useTheme from '../src/hooks/use_theme.js';
import createExtensionRoot, {
  keepExtensionRootConnected,
} from '../src/lib/create_extension_root.js';
import { KEYMOVE_INPUT_ID, KEYMOVE_ROOT_ID } from '../src/constants.js';
import contentStyles from '../src/content.css?inline';
import onboardingStyles from './demo-onboarding.css?inline';
import popupStyles from '../src/popup.css?inline';
import '../src/highlights.css';
import { browser, notifyDemo, showDemoSearch } from './browser-adapter.js';
import { isDemoCommand, LESSONS } from './protocol.js';
import './demo.css';

function DemoSettings({ host, onClose }: { host: HTMLElement; onClose: () => void }) {
  const settings = useStoredSettings();
  const interaction = useInteractionSettings();
  const colors = useHighlightColors();
  const position = usePopupPosition();
  const width = usePopupWidth();
  useTheme(settings.theme, host);
  return (
    <PopupSettingsView
      settings={settings}
      interaction={interaction}
      colors={colors}
      position={position}
      width={width}
      hostname={location.hostname}
      searchUnavailable={
        !interaction.ready
          ? 'Loading page settings…'
          : interaction.sites[location.hostname] === 'paused'
            ? 'Paused on this site. Resume in Sites.'
            : null
      }
      onShowSearch={async () => {
        await showDemoSearch();
        onClose();
      }}
    />
  );
}

function SamplePage() {
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsHost = useRef<HTMLDivElement>(null);
  const visitDialog = useRef<HTMLDialogElement>(null);
  const detours = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [picnic, setPicnic] = useState(false);
  const [pace, setPace] = useState('Unhurried');
  const [visitBooked, setVisitBooked] = useState(false);
  useEffect(() => {
    const owner = detours.current;
    if (!owner) return;
    const enter = () => setMenuOpen(true);
    const leave = () => setMenuOpen(false);
    owner.addEventListener('mouseenter', enter);
    owner.addEventListener('mouseleave', leave);
    return () => {
      owner.removeEventListener('mouseenter', enter);
      owner.removeEventListener('mouseleave', leave);
    };
  }, []);
  useEffect(() => {
    const onNotice = (event: Event) => {
      if (event instanceof CustomEvent && typeof event.detail === 'string') setNotice(event.detail);
    };
    const onSettings = () => setSettingsOpen(value => !value);
    window.addEventListener('keymove-demo:notice', onNotice);
    window.addEventListener('keymove-demo:settings', onSettings);
    return () => {
      window.removeEventListener('keymove-demo:notice', onNotice);
      window.removeEventListener('keymove-demo:settings', onSettings);
    };
  }, []);
  useEffect(() => {
    if (!settingsOpen || !settingsHost.current) return;
    const shadow = settingsHost.current.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `${contentStyles}\n${popupStyles}\n#keymove-popup { padding: 18px; background: var(--keymove-popup-surface, #1c1c1c); border-radius: 8px; }`;
    const mount = document.createElement('div');
    shadow.append(style, mount);
    const root = createRoot(mount);
    root.render(
      <DemoSettings host={settingsHost.current} onClose={() => setSettingsOpen(false)} />,
    );
    return () => queueMicrotask(() => root.unmount());
  }, [settingsOpen]);

  return (
    <>
      <header className="sample-header">
        <span className="sample-brand">
          the small hours<span aria-hidden="true">®</span>
        </span>
        <span className="sample-edition">FIELD NOTES / No. 024</span>
      </header>
      <main className="sample-main">
        <div className="sample-meta">
          WEEKENDS, RECONSIDERED <span>5 MIN READ</span>
        </div>
        <h1>A slower Saturday.</h1>
        <p className="sample-deck">
          A good walk. A proper coffee.
          <br />A little room for whatever comes next.
        </p>
        <div className="sample-rule" />
        <div className="sample-columns">
          <article>
            <h2>Start somewhere small.</h2>
            <p>
              Leave the long list at home. Find a corner café, order a coffee, and let the morning
              take its time.
            </p>
            <p>
              Take the scenic route to the bookshop. Pick something for the first page, not the
              cover. There’s no rush.
            </p>
          </article>
          <aside className="sample-checklist">
            <span className="sample-label">THE SHORT LIST</span>
            <ul>
              <li>Find your coffee spot</li>
              <li>Browse a bookshop</li>
              <li>Leave the afternoon open</li>
            </ul>
            <a
              href="#checklist"
              onClick={() =>
                setNotice(
                  'Checklist opened. One small plan: coffee, a bookshop, and an unhurried afternoon.',
                )
              }
            >
              Open the checklist <span aria-hidden="true">↗</span>
            </a>
          </aside>
        </div>
        <div className="sample-actions">
          <button
            type="button"
            aria-pressed={saved}
            onClick={() => {
              setSaved(value => !value);
              setNotice(
                saved
                  ? 'Guide removed from your saved list.'
                  : 'Guide saved. You just activated a button with KeyMove.',
              );
            }}
          >
            {saved ? 'Guide saved ✓' : 'Save this guide'}
          </button>
          <span>For a day with fewer tabs open.</span>
        </div>
        <div id="checklist" className="sample-status" role="status" aria-live="polite">
          {notice || 'Your next great idea can wait until after coffee.'}
        </div>
        <section className="sample-planner" aria-labelledby="planner-title">
          <span className="sample-label">A DAY OF YOUR OWN</span>
          <h2 id="planner-title">Make it your Saturday.</h2>
          <div className="sample-planner-grid">
            <div className="sample-planner-fields">
              <label className="sample-tick">
                <input
                  id="picnic"
                  type="checkbox"
                  checked={picnic}
                  onChange={event => setPicnic(event.target.checked)}
                />
                Pack a picnic
              </label>
              <label htmlFor="visitor-name">Your name</label>
              <input id="visitor-name" placeholder="Add your name" autoComplete="off" />
              <label htmlFor="walking-pace">Walking pace</label>
              <select
                id="walking-pace"
                value={pace}
                onChange={event => setPace(event.target.value)}
              >
                <option>Unhurried</option>
                <option>Leisurely</option>
                <option>Brisk</option>
              </select>
              <p className="sample-status" aria-live="polite">
                {picnic ? 'Picnic packed. ' : ''}Today’s pace: {pace.toLowerCase()}.
              </p>
            </div>
            <div className="sample-planner-explore">
              <details id="rainy-day">
                <summary>Rainy day ideas</summary>
                <p>The glasshouse is a quiet spot to read while the rain passes.</p>
              </details>
              <div className="sample-detours" ref={detours}>
                <button
                  type="button"
                  aria-expanded={menuOpen}
                  aria-controls="detour-options"
                  onClick={() => setMenuOpen(value => !value)}
                >
                  Browse detours
                </button>
                <div id="detour-options" hidden={!menuOpen}>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice('Garden detour added to your Saturday.');
                      setMenuOpen(false);
                    }}
                  >
                    Garden detour
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice('Market detour added to your Saturday.');
                      setMenuOpen(false);
                    }}
                  >
                    Market detour
                  </button>
                </div>
              </div>
              <button
                type="button"
                id="plan-visit"
                onClick={() => visitDialog.current?.showModal()}
              >
                Plan a visit
              </button>
              <p className="sample-status" id="visit-status" aria-live="polite">
                {visitBooked
                  ? 'Visit confirmed. See you on Saturday.'
                  : 'A small table, a little time to yourself.'}
              </p>
              <a id="route-link" href="#riverside">
                Read the walking route
              </a>
            </div>
          </div>
          <label htmlFor="weekend-notes">Weekend notes</label>
          <textarea id="weekend-notes" rows={3} placeholder="Keep a passage or a link for later…" />
        </section>
        <section className="sample-route" id="riverside" aria-labelledby="route-title">
          <span className="sample-label">THE LONG WAY HOME</span>
          <h2 id="route-title">At the river bend.</h2>
          <p>
            Follow the towpath until the old stone bridge comes into view. The river bend is where
            the city begins to feel a little further away.
          </p>
          <p>
            Choose a bench beneath the willow, open your book, and stay for one more chapter. Some
            afternoons are better left unplanned.
          </p>
          <a href="#planner-title">Back to your Saturday plan</a>
        </section>
        <dialog ref={visitDialog} className="sample-dialog" aria-labelledby="visit-title">
          <h2 id="visit-title">Your Saturday visit</h2>
          <p>A table by the window is waiting.</p>
          <label htmlFor="visit-name">Booking name</label>
          <input id="visit-name" autoComplete="off" placeholder="Your name" />
          <div className="sample-dialog-actions">
            <button
              type="button"
              id="confirm-visit"
              onClick={() => {
                setVisitBooked(true);
                visitDialog.current?.close();
              }}
            >
              Confirm visit
            </button>
            <button type="button" onClick={() => visitDialog.current?.close()}>
              Cancel
            </button>
          </div>
        </dialog>
      </main>
      {settingsOpen && (
        <section className="demo-settings" aria-label="Demo settings">
          <div className="settings-heading">
            <strong>Demo settings</strong>
            <button type="button" onClick={() => setSettingsOpen(false)}>
              Close
            </button>
          </div>
          <p>Changes last until you reset the demo.</p>
          <div ref={settingsHost} />
        </section>
      )}
    </>
  );
}

const page = document.getElementById('sample-page');
if (page) flushSync(() => createRoot(page).render(<SamplePage />));
function mountPlayground() {
  const extension = createExtensionRoot(`${contentStyles}\n${onboardingStyles}`);
  if (!extension) throw new Error('The demo searchbar could not be mounted.');
  const observer = keepExtensionRootConnected(extension.host);
  // Keep onboarding out of the extension runtime and dismiss it for this demo session.
  extension.shadowRoot.addEventListener('input', event => {
    if (
      event.target instanceof HTMLInputElement &&
      event.target.id === KEYMOVE_INPUT_ID &&
      event.target.value
    ) {
      extension.host.setAttribute('data-demo-started', '');
    }
  });
  const root = createRoot(extension.app);
  flushSync(() =>
    root.render(
      <PortalTargetProvider target={extension.portal}>
        <ExtensionErrorBoundary>
          <Searchbar />
        </ExtensionErrorBoundary>
      </PortalTargetProvider>,
    ),
  );

  function searchInput() {
    return document
      .getElementById(KEYMOVE_ROOT_ID)
      ?.shadowRoot?.querySelector<HTMLInputElement>(`#${KEYMOVE_INPUT_ID}`);
  }

  function key(key: string, code: string, altKey = false) {
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key, code, altKey, bubbles: true, cancelable: true }),
    );
  }

  window.addEventListener('message', event => {
    if (
      event.origin !== location.origin ||
      event.source !== window.parent ||
      !isDemoCommand(event.data)
    )
      return;
    const lesson = LESSONS.find(item => item.id === event.data.lesson);
    if (!lesson) return;
    void browser.storage.local
      .set({ startInActionMode: lesson.mode === 'actions', autoHide: false })
      .then(() => {
        // Exercise the real input path, including cancellation and highlighting, without
        // exposing test-only props or a website dependency in the extension runtime.
        key('Escape', 'Escape');
        requestAnimationFrame(() => {
          void showDemoSearch()
            .then(() => {
              const input = searchInput();
              if (!input) return;
              input.focus({ preventScroll: true });
              Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(
                input,
                lesson.query,
              );
              input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
            })
            .catch((error: unknown) =>
              notifyDemo(
                error instanceof Error ? error.message : 'Could not open the demo searchbar.',
              ),
            );
        });
      });
  });

  // An explicit exit prevents result navigation from trapping keyboard-only visitors.
  window.addEventListener(
    'keydown',
    event => {
      if (
        event.isTrusted &&
        event.key === 'Escape' &&
        !searchInput()?.value &&
        !document.querySelector('dialog[open]') &&
        !document.querySelector('.demo-settings')
      ) {
        window.parent.postMessage('keymove-demo:exit', location.origin);
      }
    },
    true,
  );
  window.addEventListener('pagehide', () => observer.disconnect(), { once: true });
  requestAnimationFrame(() => window.parent.postMessage('keymove-demo:ready', location.origin));
}

// Record the same sample page with a separately installed production extension.
if (new URLSearchParams(location.search).get('extension') !== 'installed') mountPlayground();
