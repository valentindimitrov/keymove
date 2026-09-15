// This page deliberately mounts no extension UI. Browser smoke tests must load the
// production extension; opening it in preview:ui alone only shows the host page.
const size = new URLSearchParams(location.search).get('size') === 'large' ? 5000 : 100;
const fixture = document.getElementById('fixture')!;
fixture.innerHTML = `
  <h1>Browser fixture</h1>
  <p>qalpha first block</p>
  <p>qxbeta second block</p>
  <p>qxygamma third block</p>
  <p id="copy-block">qxyzdelta whole <strong>semantic block</strong> for copying.</p>
  <p hidden>qxyzdelta hidden duplicate</p>
  <p style="display:none">qxyzdelta another hidden duplicate</p>
  <p id="nested-block">Nested <a id="nested-link" href="#destination"><span>nectarine</span></a> control.</p>
  <button aria-label="apricot">Visible button label</button>
  <div id="dynamic"></div>
  <textarea aria-label="Native paste target"></textarea>
  <div id="destination">Destination</div>`;
const filler = document.createDocumentFragment();
for (let index = 0; index < size; index++) {
  const paragraph = document.createElement('p');
  paragraph.textContent = `Ordinary document block ${index}. Apples, oranges, and long-form page content.`;
  filler.appendChild(paragraph);
}
fixture.appendChild(filler);

// Reproduces host shortcuts that mistake the retargeted shadow host for a
// non-editable element. Trusted character events must still reach the input.
for (const type of ['keydown', 'keypress', 'keyup']) {
  document.addEventListener(type, event => {
    if (
      event instanceof KeyboardEvent &&
      event.target instanceof Element &&
      !event.target.matches('input, textarea, [contenteditable]') &&
      event.key.length === 1 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
    }
  });
}
document.documentElement.dataset['fixtureReady'] = String(size);
