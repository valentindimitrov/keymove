// Production-extension fixture: no mocked search or keyboard behavior.
document.body.style.cssText = 'font:16px system-ui;padding:40px;background:#fafafa;color:#18202a';
document.body.innerHTML = `<h1>Keyboard hover</h1><button>S</button>
  <nav><div id="menu"><a id="men" href="#men">Hommes</a>
    <div id="submenu" hidden><a id="sneakers" href="#sneakers">Sneakers</a></div>
  </div></nav><button id="outside">Outside menu</button>
  <div id="component"></div>`;
const menu = document.getElementById('menu')!;
const submenu = document.getElementById('submenu')!;
menu.addEventListener('mouseenter', () => {
  submenu.hidden = false;
});
menu.addEventListener('mouseleave', () => {
  submenu.hidden = true;
});
document.querySelectorAll('a').forEach(link =>
  link.addEventListener('click', event => {
    event.preventDefault();
    document.documentElement.dataset['clicked'] = link.id;
  }),
);
const root = document.getElementById('component')!.attachShadow({ mode: 'open' });
root.innerHTML =
  '<style>:host{display:block;margin-top:30px}</style><div><a href="#collections">Collections</a><p hidden>Velvet footwear</p></div>';
const owner = root.querySelector('div')!;
const panel = root.querySelector('p')!;
// Delegated mouseover/out (as used by framework menus) rather than native enter/leave.
owner.addEventListener('mouseover', () => {
  panel.hidden = false;
});
owner.addEventListener('mouseout', event => {
  if (!(event.relatedTarget instanceof Node) || !owner.contains(event.relatedTarget))
    panel.hidden = true;
});
document.documentElement.dataset['fixtureReady'] = 'hover';
