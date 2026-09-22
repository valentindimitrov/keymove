import { setFrameTarget } from './frame_target.js';
import { SelectionHover } from './selection_hover.js';

afterEach(() => {
  document.body.innerHTML = '';
});

test('moves into a submenu without leaving shared ancestors, then releases it', () => {
  document.body.innerHTML =
    '<nav><div id="menu"><a id="men">Hommes</a><div><a id="shoes">Sneakers</a></div></div></nav><p>Outside</p>';
  const menu = document.getElementById('menu')!;
  const men = document.getElementById('men')!;
  const shoes = document.getElementById('shoes')!;
  const outside = document.querySelector('p')!;
  const enter = vi.fn();
  const leave = vi.fn();
  const out = vi.fn();
  menu.addEventListener('mouseenter', enter);
  menu.addEventListener('mouseleave', leave);
  men.addEventListener('mouseout', out);
  const hover = new SelectionHover();
  hover.select(men);
  hover.select(shoes);
  expect(enter).toHaveBeenCalledTimes(1);
  expect(leave).not.toHaveBeenCalled();
  expect(out.mock.calls[0]![0].relatedTarget).toBe(shoes);
  hover.select(outside);
  expect(leave).toHaveBeenCalledTimes(1);
  expect(leave.mock.calls[0]![0].relatedTarget).toBe(outside);
  hover.clear();
});

test('crosses open roots and slots with composed over events and non-bubbling enter events', () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = '<section><slot></slot><button>Nested</button></section>';
  const link = document.createElement('a');
  host.append(link);
  const section = root.querySelector('section')!;
  const enter = vi.fn();
  const over = vi.fn();
  section.addEventListener('mouseenter', enter);
  host.addEventListener('mouseover', over);
  const hover = new SelectionHover();
  hover.select(link);
  expect(enter).toHaveBeenCalledTimes(1);
  expect(enter.mock.calls[0]![0].bubbles).toBe(false);
  hover.select(root.querySelector('button'));
  expect(enter).toHaveBeenCalledTimes(1);
  expect(over).toHaveBeenCalledTimes(2);
  expect(over.mock.calls[1]![0].composed).toBe(true);
  hover.clear();
});

test('rejects unavailable targets and clears stale hover on removal or modal changes', () => {
  document.body.innerHTML =
    '<div><button>Menu</button></div><button disabled>Disabled</button><p hidden>Hidden</p><div id="keymove-root"><a>UI</a></div>';
  const button = document.querySelector('button')!;
  const container = button.parentElement!;
  const leave = vi.fn();
  const enter = vi.fn();
  container.addEventListener('mouseleave', leave);
  document.body.addEventListener('mouseover', enter);
  const hover = new SelectionHover();
  for (const node of [
    document.querySelector('[disabled]'),
    document.querySelector('[hidden]'),
    document.querySelector('a'),
    document.createElement('button'),
  ])
    hover.select(node);
  expect(enter).not.toHaveBeenCalled();
  hover.select(button);
  button.remove();
  hover.reconcile();
  expect(leave).toHaveBeenCalledTimes(1);
  container.append(button);
  hover.select(button);
  document.body.insertAdjacentHTML(
    'beforeend',
    '<div role="dialog" aria-modal="true">Dialog</div>',
  );
  hover.reconcile();
  expect(leave).toHaveBeenCalledTimes(2);
  hover.select(button);
  expect(enter).toHaveBeenCalledTimes(2);
  hover.clear();
});

test('synchronous teardown from a page event cannot leave an active hover behind', () => {
  const button = document.createElement('button');
  document.body.append(button);
  const hover = new SelectionHover();
  const enter = vi.fn();
  const out = vi.fn();
  button.addEventListener('pointerover', () => hover.clear());
  button.addEventListener('mouseenter', enter);
  button.addEventListener('pointerout', out);
  hover.select(button);
  expect(enter).not.toHaveBeenCalled();
  expect(out).toHaveBeenCalledTimes(1);
  hover.clear();
  expect(out).toHaveBeenCalledTimes(1);
});

test('real pointer takeover within the menu preserves its shared ancestors', () => {
  document.body.innerHTML = '<nav><a>Hommes</a><button>Sneakers</button></nav>';
  const menu = document.querySelector('nav')!;
  const button = document.querySelector('button')!;
  const leave = vi.fn();
  const enter = vi.fn();
  menu.addEventListener('mouseleave', leave);
  button.addEventListener('mouseenter', enter);
  const hover = new SelectionHover();
  hover.select(document.querySelector('a'));
  hover.releaseTo(button);
  hover.clear();
  expect(leave).not.toHaveBeenCalled();
  expect(enter).not.toHaveBeenCalled();
});
test('hover navigation inside one iframe retains the expanded menu', () => {
  document.body.innerHTML =
    '<iframe></iframe><nav><a href="#menu">Menu</a><div hidden><a href="#item">Item</a></div></nav>';
  const boundary = document.querySelector('iframe')!;
  const menu = document.querySelector('nav')!;
  const trigger = menu.querySelector('a')!;
  const panel = menu.querySelector('div')!;
  const item = panel.querySelector('a')!;
  menu.addEventListener('mouseenter', () => {
    panel.hidden = false;
  });
  menu.addEventListener('mouseleave', () => {
    panel.hidden = true;
  });
  const childHover = new SelectionHover();
  let triggerListed = true;
  const handles = [trigger, item].map((target, id) => {
    const handle = document.createElement('a');
    setFrameTarget(handle, {
      row: {
        id,
        kind: 'action',
        action: null,
        label: target.textContent!,
        text: '',
        context: '',
        href: target.href,
        disabled: false,
        focusable: true,
        score: 1,
        term: null,
        distance: null,
      },
      boundary,
      alive: () => id === 1 || triggerListed,
      paint: () => {},
      command: async command => {
        if (command === 'hover') childHover.select(target);
        if (command === 'unhover') childHover.clear();
        return true;
      },
    });
    return handle;
  });
  const topHover = new SelectionHover();
  try {
    topHover.select(handles[0]!);
    expect(panel.hidden).toBe(false);
    triggerListed = false;
    topHover.reconcile();
    expect(panel.hidden).toBe(false);
    topHover.select(handles[1]!);
    expect(panel.hidden).toBe(false);
  } finally {
    topHover.clear();
    childHover.clear();
    document.body.innerHTML = '';
  }
});
