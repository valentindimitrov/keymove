import { createRoot } from 'react-dom/client';
import SiteHeader from './site-header.js';
import SiteFooter from './site-footer.js';
import Shortcut from './shortcut.js';
import PatternClip from './pattern-clip.js';
import { patternGroups } from './patterns-data.js';
import './website.css';
import './patterns.css';

function PatternsPage() {
  return (
    <>
      <a className="skip-link" href="#pattern-library">
        Skip to navigation patterns
      </a>
      <SiteHeader patterns />
      <main className="patterns-page wrap">
        <div className="patterns-intro">
          <h1>Navigation patterns</h1>
          <p>Find what you see. Go where you need. Turn a selected word into your next action.</p>
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
                      <PatternClip id={pattern.id} title={pattern.title} />
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
      <SiteFooter />
    </>
  );
}

const mount = document.getElementById('website');
if (mount) createRoot(mount).render(<PatternsPage />);
