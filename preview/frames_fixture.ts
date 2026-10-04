const frame = document.querySelector('#cross');
const toggle = document.querySelector('#toggle');
const reload = document.querySelector('#reload');
if (
  !(frame instanceof HTMLIFrameElement) ||
  !(toggle instanceof HTMLButtonElement) ||
  !(reload instanceof HTMLButtonElement)
) {
  throw new Error('Iframe fixture controls are missing');
}
const url = new URL('./frame-child.html?name=remote&nested=1', location.href);
url.hostname = location.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
frame.src = url.href;
const count = Number(new URLSearchParams(location.search).get('frames') ?? 3);
if (count === 0) document.querySelectorAll('iframe').forEach(node => node.remove());
for (let i = 3; i < Math.min(count, 20); i++) {
  const extra = document.createElement('iframe');
  extra.title = 'Extra form ' + i;
  extra.src = './frame-child.html?name=additional';
  document.body.append(extra);
}
toggle.onclick = () => {
  frame.hidden = !frame.hidden;
};
reload.onclick = () => {
  frame.src = url.href + '&reload=' + Date.now();
};
document.documentElement.dataset.fixtureReady = 'true';
