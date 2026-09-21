import { createRoot } from 'react-dom/client';
import SiteHeader from './site-header.js';
import Shortcut from './shortcut.js';
import { patternGroups } from './patterns-data.js';
import './website.css';
import './patterns.css';

function PatternsPage() {
  let number = 0;
  return (
    <>
      <a className="skip-link" href="#pattern-library">
        Skip to navigation patterns
      </a>
      <SiteHeader patterns />
      <main className="patterns-page wrap">
        <div className="patterns-intro">
          <a className="patterns-back" href="./#playground">
            Back to the live demo
          </a>
          <span className="eyebrow">THE KEYMOVE FIELD GUIDE</span>
          <h1>Navigation patterns</h1>
          <p>Find what you see. Go where you need. Turn a selected word into your next action.</p>
          <div className="patterns-status">19 patterns · Animated clips coming soon</div>
        </div>
        <nav className="patterns-index" aria-label="Pattern categories">
          {patternGroups.map(group => (
            <a key={group.id} href={`#${group.id}`}>
              {group.title}
              <span>{group.patterns.length}</span>
            </a>
          ))}
        </nav>
        <div id="pattern-library">
          {patternGroups.map(group => (
            <section
              className="pattern-group"
              id={group.id}
              key={group.id}
              aria-labelledby={`${group.id}-title`}
            >
              <div className="pattern-group-heading">
                <h2 id={`${group.id}-title`}>{group.title}</h2>
                <p>{group.description}</p>
              </div>
              <div className="pattern-grid">
                {group.patterns.map(pattern => {
                  number++;
                  return (
                    <article
                      className="pattern-card"
                      id={pattern.id}
                      key={pattern.id}
                      aria-labelledby={`${pattern.id}-title`}
                    >
                      <h3 className="pattern-card-title" id={`${pattern.id}-title`}>
                        {pattern.title}
                      </h3>
                      <div
                        className="pattern-placeholder"
                        role="img"
                        aria-label={`GIF placeholder for ${pattern.title}; animation not yet available`}
                      >
                        <span className="pattern-number" aria-hidden="true">
                          {String(number).padStart(2, '0')}
                        </span>
                        <svg
                          width="32"
                          height="32"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.4"
                          aria-hidden="true"
                        >
                          <rect x="3" y="4" width="18" height="16" rx="2" />
                          <path d="M3 8h18M7 4v4M12 4v4M17 4v4M10 12l5 3-5 3z" />
                        </svg>
                        <strong>GIF placeholder</strong>
                        <span>Clip coming soon</span>
                      </div>
                      <div className="pattern-content">
                        <p>{pattern.description}</p>
                        <ol>
                          {pattern.sequence.map(step => (
                            <li key={step}>{step}</li>
                          ))}
                        </ol>
                        {pattern.shortcuts.length > 0 && (
                          <div className="pattern-shortcuts" aria-label="Related shortcuts">
                            {pattern.shortcuts.map(name => (
                              <Shortcut key={name} name={name} />
                            ))}
                          </div>
                        )}
                        {pattern.note && <p className="pattern-note">{pattern.note}</p>}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
        <div className="patterns-outro">
          <p>Ready to try a few moves?</p>
          <a className="primary-button" href="./#playground">
            Open the live demo
          </a>
        </div>
      </main>
      <footer className="site-footer wrap">
        <a href="./">KeyMove home</a>
        <span>Powered by Comake.</span>
        <a href="./LICENSE.txt">License &amp; attribution</a>
      </footer>
    </>
  );
}

const mount = document.getElementById('website');
if (mount) createRoot(mount).render(<PatternsPage />);
