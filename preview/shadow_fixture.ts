// No mock extension: load the production build to exercise these components.
document.body.style.cssText = 'font:16px system-ui;padding:40px;background:#fafafa;color:#18202a';
document.body.insertAdjacentHTML(
  'afterbegin',
  '<h1>Open Shadow DOM navigation</h1><p id="before">Orbit before</p><div id="component"></div><p id="after">Orbit after</p><textarea aria-label="Paste target"></textarea>',
);
const host = document.getElementById('component')!;
const root = host.attachShadow({ mode: 'open' });
const pageSheet = new CSSStyleSheet();
pageSheet.replaceSync(':host { --page-owned-sheet: 1; }');
root.adoptedStyleSheets = [pageSheet];
root.innerHTML = `<style>:host { display:block; border:1px solid #888; padding:24px; margin:20px 0; } input,button {font:inherit;padding:8px;margin:8px;} dialog {padding:30px;} :host {--keymove-text-accent:transparent}</style>
  <p id="middle">Orbit <strong>middle</strong> paragraph.</p>
  <p id="slotted">Bright <slot name="caption">fallback</slot> ahead</p>
  <span id="local-name" hidden>Component mailbox</span><input id="mailbox" aria-labelledby="local-name">
  <label>Component digest<input id="digest" type="checkbox"></label>
  <button id="launch">Launch capsule</button><div id="nested"></div>
  <button id="open">Open component dialog</button>
  <dialog><p>Component modal text</p><button id="save">Save component</button><button id="close">Close component dialog</button></dialog>`;
host.innerHTML = '<b slot="caption">comet</b><p>Invisible unslotted text</p>';
const nested = root.getElementById('nested')!.attachShadow({ mode: 'open' });
nested.innerHTML =
  '<p id="nested-text">Orbit nested paragraph.</p><button id="nested-action">Nested ignition</button>';
root
  .getElementById('launch')!
  .addEventListener('click', () => host.setAttribute('data-launched', 'yes'));
nested
  .getElementById('nested-action')!
  .addEventListener('click', () => host.setAttribute('data-nested', 'yes'));
root
  .getElementById('open')!
  .addEventListener('click', () => root.querySelector('dialog')!.showModal());
root
  .getElementById('close')!
  .addEventListener('click', () => root.querySelector('dialog')!.close());
root
  .getElementById('save')!
  .addEventListener('click', () => host.setAttribute('data-saved', 'yes'));
document.documentElement.dataset['fixtureReady'] = 'shadow';
