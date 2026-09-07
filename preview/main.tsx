import { createRoot } from 'react-dom/client';
import createExtensionRoot from '../src/lib/create_extension_root.js';
import contentStyles from '../src/content.css?inline';
import { SCENARIOS } from './scenarios.js';
import './page.css';

// Renders the real components through the real shadow root, with the real stylesheet, so a
// visual check here is a check of what ships. `:host { all: initial }` inside that root is
// exactly the condition a plain HTML mock would fail to reproduce.
const parameters = new URLSearchParams(window.location.search);
const requested = parameters.get('scenario');
const browserName = parameters.get('browser') ?? undefined;
const scenario = SCENARIOS.find(entry => entry.name === requested);
const page = document.getElementById('preview-page')!;

function renderIndex() {
  document.title = 'KeyMove interface preview';
  page.innerHTML = `
    <h1>KeyMove interface preview</h1>
    <p>Real components in the real shadow root. Open one to screenshot it on its own.</p>
    <ul>${SCENARIOS.map(
      entry =>
        `<li><a href="?scenario=${entry.name}"><code>${entry.name}</code></a> — ${entry.description}</li>`,
    ).join('')}</ul>
    <p class="preview-note">
      Add <code>&amp;browser=firefox</code> to any of these to see the Firefox surface colours.
    </p>`;
}

function renderScenario(name: string, node: React.ReactNode) {
  document.title = `KeyMove preview — ${name}`;
  // Filler behind the bar, so transparency and the backdrop blur can be judged.
  page.innerHTML = `<div class="preview-filler">${Array.from(
    { length: 40 },
    () =>
      '<p>src/lib/page_search_index.ts — Show a ranked slate of the three strongest results</p>',
  ).join('')}</div><p class="preview-back"><a href="./">All scenarios</a></p>`;

  const extensionRoot = createExtensionRoot(contentStyles, browserName);
  if (!extensionRoot) throw new Error('The preview could not create an extension root.');
  createRoot(extensionRoot.app).render(node);
}

if (scenario) {
  renderScenario(scenario.name, scenario.render());
} else {
  renderIndex();
}
