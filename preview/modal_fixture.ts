// Shared by the visual harness and installed-extension regression checks.
export function createModalFixture(native = false) {
  const drawer = document.createElement(native ? 'dialog' : 'section');
  drawer.id = 'transformed-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-label', 'Sort products');
  drawer.style.cssText =
    'position:fixed;inset:0 0 0 auto;width:55vw;height:100vh;max-width:none;max-height:none;margin:0;border:0;box-sizing:border-box;padding:40px;background:white;color:black;transform:translateX(0);overflow:auto;z-index:100';
  drawer.innerHTML =
    '<h2>Sort products</h2><button>Prix</button><ul><li id="price-low">Prix (Bas - Haut)</li><li>Prix (Haut - Bas)</li></ul>';
  document.body.append(drawer);
  if (drawer instanceof HTMLDialogElement) drawer.showModal();
  return drawer;
}
