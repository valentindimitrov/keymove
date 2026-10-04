import {
  closestAcrossRoots,
  renderedContains,
  renderedParent,
  walkRenderedElements,
} from './dom_tree.js';
import { isTextVisible } from './visible_text.js';
import { activeModal, actionIsInScope } from './modal_context.js';
import { isActionDisabled } from './searchable_attributes.js';
import { imageUrl } from './image_schema.js';
import type { ImageDirection, ImageInfo } from './image_schema.js';
import Utils from './utils.js';

const CARD_BOUNDARY = 'article, li, figure, td, [role="listitem"]';

function onScreen(rect: DOMRect): boolean {
  return rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
}

async function findImage(
  root: Element,
  score: (image: HTMLImageElement) => number,
  cancelled: () => boolean,
): Promise<HTMLImageElement | null> {
  let best: HTMLImageElement | null = null;
  let bestScore = Infinity;
  let visited = 0;
  // One rendered traversal avoids spending the budget repeatedly on nested wrappers.
  for (const node of walkRenderedElements(root)) {
    if (++visited > 12000 || cancelled()) break;
    if (visited % 100 === 0) {
      await new Promise<void>(resolve => setTimeout(resolve, 0));
      if (cancelled()) return null;
    }
    if (!(node instanceof HTMLImageElement) || !usable(node)) continue;
    const value = score(node);
    if (value < bestScore) {
      best = node;
      bestScore = value;
    }
  }
  return cancelled() ? null : best;
}

function usable(image: HTMLImageElement): boolean {
  const rect = image.getBoundingClientRect();
  // Exclude carousel slides clipped out of their track, but keep off-screen page
  // images navigable: scrolling the document can reveal those normally.
  for (
    let parent = renderedParent(image);
    parent && !parent.matches('body, html');
    parent = renderedParent(parent)
  ) {
    const style = getComputedStyle(parent);
    const bounds = parent.getBoundingClientRect();
    if (
      ['hidden', 'clip'].includes(style.overflowX) &&
      (rect.right <= bounds.left || rect.left >= bounds.right)
    )
      return false;
    if (
      ['hidden', 'clip'].includes(style.overflowY) &&
      (rect.bottom <= bounds.top || rect.top >= bounds.bottom)
    )
      return false;
  }
  return (
    image.isConnected &&
    isTextVisible(image) &&
    actionIsInScope(image, activeModal()) &&
    !closestAcrossRoots(image, '[aria-hidden="true"], [inert]') &&
    !['presentation', 'none'].includes(image.getAttribute('role') ?? '') &&
    rect.width >= 48 &&
    rect.height >= 48 &&
    imageUrl(image.currentSrc || image.src) !== null
  );
}

/** Only inspect a bounded neighbourhood on request, never the page-wide search index. */
export function relatedImages(
  source: Element,
): { scope: Element; images: HTMLImageElement[] } | null {
  if (!source.isConnected || !isTextVisible(source) || !actionIsInScope(source, activeModal()))
    return null;
  let scope: Element | null = source;
  const sourceCard = closestAcrossRoots(source, CARD_BOUNDARY);
  let remaining = 600;
  for (let depth = 0; scope && depth < 7; depth++, scope = renderedParent(scope)) {
    if (scope.matches('body, html, main, nav, [role="main"], [role="navigation"]')) break;
    const images: HTMLImageElement[] = [];
    for (const node of walkRenderedElements(scope)) {
      if (--remaining < 0) return null;
      if (node instanceof HTMLImageElement && usable(node)) images.push(node);
      if (images.length > 12) return null;
    }
    if (images.length) {
      // A grid/list of cards is not a card. Do not borrow a neighbouring card's photo.
      if (!scope.matches('a[href], figure')) {
        for (const image of images) {
          let branch: Element = image;
          while (renderedParent(branch) && renderedParent(branch) !== scope)
            branch = renderedParent(branch)!;
          // A card's image header can contain badges or wishlist button labels.
          // Shared semantic ownership is stronger evidence than that incidental
          // text, but never extend the exemption to a nested neighbouring card.
          const sameCard =
            sourceCard !== null && closestAcrossRoots(image, CARD_BOUNDARY) === sourceCard;
          if (!sameCard && !renderedContains(branch, source) && (branch.textContent ?? '').trim())
            return null;
        }
      }
      return { scope, images };
    }
    if (scope.matches(CARD_BOUNDARY)) break;
  }
  return null;
}

export class RelatedImageSelection {
  source: Element | null = null;
  node: HTMLImageElement | null = null;
  private scope: Element | null = null;
  private images: HTMLImageElement[] = [];
  private token = '';
  private url = '';
  private revision = 0;
  clear() {
    this.revision++;
    this.source = this.node = this.scope = null;
    this.images = [];
    this.token = this.url = '';
  }
  async start(): Promise<ImageInfo | null> {
    const revision = this.revision;
    const scope = activeModal() ?? document.body;
    if (!scope) return null;
    const image = await findImage(
      scope,
      image => {
        const rect = image.getBoundingClientRect();
        return onScreen(rect)
          ? Math.hypot(
              (rect.left + rect.right - innerWidth) / 2,
              (rect.top + rect.bottom - innerHeight) / 2,
            )
          : Infinity;
      },
      () => this.revision !== revision,
    );
    if (!image || this.revision !== revision) return null;
    this.source = scope;
    return this.select(scope, [image], image);
  }
  next(source: Element): ImageInfo | null {
    const found = relatedImages(source);
    if (!found) {
      this.clear();
      return null;
    }
    const previous = source === this.source ? found.images.indexOf(this.node!) : -1;
    this.source = source;
    return this.select(
      found.scope,
      found.images,
      found.images[(previous + 1) % found.images.length]!,
    );
  }
  private select(
    scope: Element,
    images: HTMLImageElement[],
    node: HTMLImageElement,
  ): ImageInfo | null {
    this.revision++;
    this.scope = scope;
    this.images = images;
    this.node = node;
    this.token = Array.from(crypto.getRandomValues(new Uint32Array(4)), part =>
      part.toString(16),
    ).join('-');
    this.url = this.node.currentSrc || this.node.src;
    return this.info(this.token);
  }
  async move(token: string, direction: ImageDirection): Promise<ImageInfo | null> {
    if (!this.info(token) || !this.node) return null;
    const origin = this.node.getBoundingClientRect();
    const horizontal = direction === 'left' || direction === 'right';
    const sign = direction === 'left' || direction === 'up' ? -1 : 1;
    const scope = activeModal() ?? document.body;
    if (!scope) return null;
    const best = await findImage(
      scope,
      image => {
        if (image === this.node) return Infinity;
        const rect = image.getBoundingClientRect();
        const dx = (rect.left + rect.right - origin.left - origin.right) / 2;
        const dy = (rect.top + rect.bottom - origin.top - origin.bottom) / 2;
        const forward = (horizontal ? dx : dy) * sign;
        const sideways = horizontal
          ? Math.max(0, rect.top - origin.bottom, origin.top - rect.bottom)
          : Math.max(0, rect.left - origin.right, origin.left - rect.right);
        if (forward <= 1 || sideways > forward) return Infinity;
        // Edge separation handles a large photo next to a small thumbnail. Prefer
        // on-screen candidates over off-screen images elsewhere in the gallery.
        return (onScreen(rect) ? 0 : 1e8) + forward + sideways * 2;
      },
      () => this.token !== token,
    );
    if (!this.info(token)) return null;
    return best ? this.select(scope, [best], best) : this.info(token);
  }
  info(token: string): ImageInfo | null {
    if (
      token !== this.token ||
      !this.source?.isConnected ||
      !this.scope ||
      !this.node ||
      !usable(this.node) ||
      !isTextVisible(this.source) ||
      !actionIsInScope(this.source, activeModal()) ||
      !renderedContains(this.scope, this.source) ||
      !renderedContains(this.scope, this.node) ||
      (this.node.currentSrc || this.node.src) !== this.url
    )
      return null;
    const link = closestAcrossRoots(this.node, 'a[href]');
    return {
      token,
      url: this.url,
      label: this.node.alt.trim() || 'Related image',
      link:
        link instanceof HTMLElement && !isActionDisabled(link)
          ? Utils.openableLinkUrlForNode(link)
          : null,
      position: this.images.indexOf(this.node) + 1,
      count: this.images.length,
    };
  }
  activate(token: string): boolean {
    if (!this.info(token)?.link || !this.node) return false;
    const link = closestAcrossRoots(this.node, 'a[href]');
    if (!(link instanceof HTMLElement) || isActionDisabled(link)) return false;
    link.click();
    return true;
  }
  copy(token: string): Promise<void> {
    const node = this.node;
    if (
      !this.info(token) ||
      !node ||
      !node.complete ||
      !node.naturalWidth ||
      node.naturalWidth * node.naturalHeight > 32_000_000
    )
      return Promise.reject(new Error('Image unavailable or too large to copy.'));
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined')
      return Promise.reject(new Error('Image copying is unavailable in this browser or page.'));
    // Start the clipboard operation during the key/click gesture. Canvas deliberately
    // preserves the browser's origin-clean restriction; no privileged image fetch.
    const png = new Promise<Blob>((resolve, reject) => {
      const canvas = document.createElement('canvas');
      canvas.width = node.naturalWidth;
      canvas.height = node.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('Canvas unavailable.'));
        return;
      }
      context.drawImage(node, 0, 0);
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Image conversion failed.'))),
        'image/png',
      );
    });
    // Observe conversion failures even if clipboard.write rejects before consuming it.
    void png.catch(() => {});
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
  }
}
