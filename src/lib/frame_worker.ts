import { browser, type Browser } from 'wxt/browser';
import {
  FRAME_MESSAGE,
  FRAME_PROBE,
  isFrameEnvelope,
  isFrameId,
  isFrameRequest,
  isFrameToken,
} from './frame_protocol.js';
import type { FrameReply, FrameRequest, FrameRow } from './frame_protocol.js';
import { PageSearchIndex } from './page_search_index.js';
import type { SearchResult } from './page_search_index.js';
import NodeScorer from './node_scorer.js';
import { normalizeSearchText } from './search_text.js';
import { FrameSearch, mergeFrameResults, connectedFrameResults } from './frame_search.js';
import { frameTarget, resultIsConnected, paintFrameTargets } from './frame_target.js';
import { isTextVisible, visibleText } from './visible_text.js';
import { activeModal, actionIsInScope } from './modal_context.js';
import { isActionDisabled } from './searchable_attributes.js';
import { labelForNode, kindLabelForNode, landmarkForNode } from './suggestion_context.js';
import { SelectionHover } from './selection_hover.js';
import Utils from './utils.js';
import { isTrustedInput } from './trusted_input.js';
import {
  matchesOpeningShortcut,
  parseOpeningShortcut,
  parseSiteBehavior,
} from './interaction_settings_schema.js';
import { isRecord } from './runtime_schema.js';
import { rgbaForHexColor } from './highlight_colors_schema.js';
import {
  concreteHighlightStyles,
  scheduleHighlightRanges,
  shadowHighlightStyles,
} from '../hooks/use_highlights.js';
import { KEYMOVE_HIGHLIGHT_NAME, ACTION_PRIORITY_BOOST } from '../constants.js';
import { markKeyMoveRoot, renderedParent } from './dom_tree.js';
import { signKeyMoveHost } from './host_marker.js';
import { RelatedImageSelection } from './related_images.js';
import { isImageDirection } from './image_schema.js';

/** `alive` retires an orphaned helper and returns false once its extension is gone. */
export function installFrameWorker(alive: () => boolean = () => true) {
  let index: PageSearchIndex | null = null;
  let controller: AbortController | null = null;
  let owner = 0;
  let generation = '';
  let nextId = 0;
  const ids = new WeakMap<Element, number>();
  let nodes = new Map<number, Element>();
  let textMatches: SearchResult['matchingText'] = [];
  const hover = new SelectionHover();
  const imageSelection = new RelatedImageSelection();
  let imageToken = '';
  const children = new FrameSearch(changed);
  let nestedQuery = '';
  let searchQuery = '';
  let textMatchesQuery = '';
  let nestedResults: SearchResult[] = [];
  let marks: HTMLElement | null = null;
  let lastPaint: Extract<FrameRequest, { op: 'paint' }> | null = null;
  let clearChildren = () => {};
  let clearHighlights = () => {};
  let changeTimer: ReturnType<typeof setTimeout> | undefined;
  let shortcut = parseOpeningShortcut(undefined);
  let ready = false;
  let behavior: 'type' | 'shortcut' | 'paused' = 'paused';
  let disposed = false;
  let origin: { left: number; top: number } | null = null;
  const scrollOrigins = new Map<Element, { left: number; top: number }>();
  function remember(node: Element) {
    origin ??= { left: scrollX, top: scrollY };
    for (
      let current: Element | null = frameTarget(node)?.boundary ?? node;
      current;
      current = renderedParent(current)
    ) {
      if (!scrollOrigins.has(current))
        scrollOrigins.set(current, { left: current.scrollLeft, top: current.scrollTop });
    }
  }
  // An orphan has no runtime to message: retire instead of throwing.
  const send = async (message: Record<string, unknown>): Promise<unknown> => {
    if (!alive()) return null;
    try {
      return await browser.runtime.sendMessage({ type: FRAME_MESSAGE, ...message });
    } catch {
      alive();
      return null;
    }
  };
  function changed() {
    hover.reconcile();
    if (imageToken && !imageSelection.info(imageToken)) {
      imageSelection.clear();
      imageToken = '';
      clearMarks();
    }
    if (!generation || changeTimer !== undefined) return;
    changeTimer = setTimeout(() => {
      changeTimer = undefined;
      if (generation) void send({ kind: 'changed', frameId: owner });
    }, 100);
  }
  function identity(node: Element) {
    let id = ids.get(node);
    if (id === undefined) {
      id = ++nextId;
      ids.set(node, id);
    }
    return id;
  }
  function available(node: Element | undefined) {
    return resultIsConnected(node) && isTextVisible(node) && actionIsInScope(node, activeModal());
  }
  function clearMarks() {
    clearHighlights();
    clearHighlights = () => {};
    marks?.remove();
    marks = null;
    lastPaint = null;
    clearChildren();
  }
  function paint(request: Extract<FrameRequest, { op: 'paint' }>) {
    clearMarks();
    lastPaint = request;
    const matching = request.ids.flatMap(id => {
      const node = nodes.get(id);
      return available(node) ? [node!] : [];
    });
    const selected = request.selected === null ? null : (nodes.get(request.selected) ?? null);
    clearChildren = paintFrameTargets(matching, selected, request.color, request.highlight);
    if (
      request.highlight &&
      // Retained matches from a finished search for another query must not be shown
      // while this frame searches again; a cached painter can still reach it meanwhile.
      textMatchesQuery === searchQuery &&
      typeof CSS !== 'undefined' &&
      CSS.highlights &&
      typeof window.Highlight !== 'undefined'
    ) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(concreteHighlightStyles(request.color));
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
      let removeShadowStyles = () => {};
      const cancel = scheduleHighlightRanges(
        textMatches.filter(match => !frameTarget(match.node)),
        ranges => {
          removeShadowStyles = shadowHighlightStyles(ranges, request.color);
          CSS.highlights.set(KEYMOVE_HIGHLIGHT_NAME, new window.Highlight(...ranges));
        },
      );
      clearHighlights = () => {
        cancel();
        removeShadowStyles();
        CSS.highlights.delete(KEYMOVE_HIGHLIGHT_NAME);
        document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
          existing => existing !== sheet,
        );
      };
    }
    const selectedImage = imageSelection.info(imageToken) ? imageSelection.node : null;
    const local = selectedImage ? [selectedImage] : matching.filter(node => !frameTarget(node));
    if (!local.length) return;
    marks = document.createElement('div');
    marks.id = 'keymove-root';
    markKeyMoveRoot(marks);
    // Important, like the top frame's :host rules: an empty div is what page rules such
    // as `div:empty { display: none }` hide, and only inline important declarations beat
    // the page's own important ones.
    marks.style.cssText = [
      'all:initial',
      'position:fixed',
      'inset:0',
      'pointer-events:none',
      'z-index:2147483647',
    ]
      .map(declaration => `${declaration} !important;`)
      .join('');
    const shadow = marks.attachShadow({ mode: 'open' });
    signKeyMoveHost(shadow);
    for (const node of local) {
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const outline = document.createElement('div');
      const current = node === selected || node === selectedImage;
      outline.className = current
        ? 'keymove-selection keymove-selected-selection'
        : 'keymove-selection';
      outline.style.cssText = `position:fixed;box-sizing:border-box;pointer-events:none;border:2px solid ${current ? request.color : rgbaForHexColor(request.color, 0.4)};border-radius:5px;left:${rect.left - 4}px;top:${rect.top - 4}px;width:${rect.width + 8}px;height:${rect.height + 8}px;`;
      if (current) outline.style.backgroundColor = rgbaForHexColor(request.color, 0.16);
      shadow.append(outline);
    }
    (activeModal() ?? document.documentElement).append(marks);
  }
  const refreshPaint = () => {
    if (lastPaint) paint(lastPaint);
  };
  async function serialize(result: SearchResult, signal: AbortSignal): Promise<FrameRow[]> {
    const currentNodes = new Map<number, Element>();
    const rememberIdentity = (node: Element) => {
      const id = identity(node);
      currentNodes.set(id, node);
      return id;
    };
    const rows: FrameRow[] = [];
    const actions = new Set(result.matchingLinksAndButtons);
    for (const match of result.matchingText) if (match.action) actions.add(match.action);
    const ranked = new Map(result.suggestions.map(row => [row.node, row]));
    const row = (
      node: Element,
      kind: 'action' | 'text',
      score: number,
      term: string | null,
      distance: number | null,
      action: number | null,
    ): FrameRow => ({
      id: rememberIdentity(node),
      kind,
      action,
      label: labelForNode(node, kind),
      text: kind === 'text' ? visibleText(node) : '',
      context: [kindLabelForNode(node, kind), landmarkForNode(node)].filter(Boolean).join(' · '),
      href: kind === 'action' ? Utils.linkUrlForNode(node as HTMLElement) : null,
      disabled: isActionDisabled(node),
      focusable: node instanceof HTMLElement && node.tabIndex >= 0,
      score,
      term,
      distance,
    });
    let deadline = performance.now() + 8;
    const pause = async () => {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (performance.now() >= deadline) {
        await new Promise(resolve => setTimeout(resolve, 0));
        deadline = performance.now() + 8;
      }
    };
    for (const node of actions) {
      const match = ranked.get(node);
      rows.push(
        row(
          node,
          'action',
          result.matchingLinksAndButtons.includes(node)
            ? (match?.score ?? 1) / ACTION_PRIORITY_BOOST
            : 0,
          match?.term ?? null,
          match?.distance ?? null,
          null,
        ),
      );
      await pause();
    }
    for (const match of result.matchingText) {
      rows.push(
        row(
          match.node,
          'text',
          match.score,
          match.term,
          match.distance,
          match.action ? rememberIdentity(match.action) : null,
        ),
      );
      await pause();
    }
    if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    nodes = currentNodes;
    textMatches = result.matchingText;
    // A newer search for another query aborts this one, so these matches are its query's.
    textMatchesQuery = searchQuery;
    return rows;
  }
  function stop() {
    imageSelection.clear();
    imageToken = '';
    controller?.abort();
    controller = null;
    generation = '';
    clearTimeout(changeTimer);
    changeTimer = undefined;
    clearMarks();
    hover.clear();
    Utils.clearPageSelection();
    index?.disconnect();
    index = null;
    children.stop();
    nestedResults = [];
    nestedQuery = '';
    searchQuery = '';
    nodes.clear();
    textMatches = [];
    textMatchesQuery = '';
    origin = null;
    scrollOrigins.clear();
  }
  async function handle(request: FrameRequest, requester: number): Promise<unknown> {
    if (request.op === 'search') {
      imageSelection.clear();
      imageToken = '';
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      owner = requester;
      // Marks for another query are stale. A frame left without rows is never painted
      // again, so its clearing paint may never come. A refresh keeps them for repainting.
      if (request.query !== searchQuery) clearMarks();
      searchQuery = request.query;
      generation = request.generation;
      if (!index || index.root !== document.body) {
        index?.disconnect();
        index = new PageSearchIndex(changed);
      }
      const local = await index.search(
        new NodeScorer(normalizeSearchText(request.query).trimStart()),
        { signal },
      );
      if (nestedQuery !== request.query) nestedResults = [];
      nestedQuery = request.query;
      const initial = mergeFrameResults([local, ...connectedFrameResults(nestedResults)]);
      const rows = await serialize(initial, signal);
      if (signal.aborted) return null;
      // Respond before waiting on descendants, then serialize incremental snapshots in
      // order. Each ancestor has its own bounded wait; a slow child cannot consume it.
      let updates = Promise.resolve();
      void children
        .search(
          request.query,
          signal,
          nested => {
            updates = updates
              .then(async () => {
                if (signal.aborted) return;
                const result = mergeFrameResults([local, ...nested]);
                const rows = await serialize(result, signal);
                if (signal.aborted) return;
                nestedResults = nested;
                await send({
                  kind: 'results',
                  frameId: requester,
                  reply: { generation: request.generation, rows, isFuzzy: result.isFuzzy },
                });
              })
              .catch(() => {});
          },
          request.depth,
        )
        .catch(() => {});
      return {
        generation: request.generation,
        rows,
        isFuzzy: initial.isFuzzy,
      } satisfies FrameReply;
    }
    if (requester !== owner) return null;
    if (request.op === 'restore') {
      children.restore();
      for (const [node, position] of scrollOrigins)
        if (node.isConnected) node.scrollTo({ ...position, behavior: 'instant' });
      if (origin) window.scrollTo({ ...origin, behavior: 'instant' });
      origin = null;
      scrollOrigins.clear();
      return true;
    }
    if (request.op === 'stop') {
      stop();
      return true;
    }
    if (request.generation !== generation) return null;
    if (request.op === 'cancel') {
      controller?.abort();
      return true;
    }
    if (request.op === 'paint') {
      paint(request);
      return true;
    }
    if (request.command === 'unhover') {
      hover.clear();
      return true;
    }
    const node = nodes.get(request.id);
    if (!available(node)) return null;
    if (request.command === 'hover') {
      // Retain nested handles too, so later transitions and query edits can
      // release their hover even after the handle leaves the result set.
      hover.select(node!);
      return true;
    }
    if (request.command === 'scroll' || request.command === 'select') remember(node!);
    const remote = frameTarget(node);
    if (remote) return remote.command(request.command);
    if (typeof request.command === 'object') {
      const { image, token } = request.command;
      if (image === 'clear') {
        // A late clear from an earlier selection cannot erase a newer image.
        if (!token || token === imageToken) {
          imageSelection.clear();
          imageToken = '';
          clearMarks();
        }
        return true;
      }
      if (image === 'next' || isImageDirection(image)) {
        if (image !== 'next' && (imageSelection.source !== node || !imageSelection.info(token)))
          return null;
        const info =
          image === 'next' ? imageSelection.next(node!) : await imageSelection.move(token, image);
        if (request.generation !== generation || !available(node)) return null;
        imageToken = info?.token ?? '';
        if (info && imageSelection.node) {
          remember(imageSelection.node);
          Utils.clearPageSelection();
          Utils.scrollToNodeAtIndexInList([imageSelection.node], 0);
          paint({
            op: 'paint',
            generation,
            selected: null,
            ids: [],
            color: '#a78bfa',
            highlight: false,
          });
        }
        return info;
      }
      if (imageSelection.source !== node) return null;
      if (image === 'info') return imageSelection.info(token);
      if (image === 'activate') return imageSelection.activate(token);
      if (image === 'copy') {
        try {
          await imageSelection.copy(token);
          return true;
        } catch {
          return false;
        }
      }
      return null;
    }
    switch (request.command) {
      case 'validate':
        return !isActionDisabled(node!);
      case 'link':
        // The link's address now: the top frame's copy may predate a change to it.
        return node instanceof HTMLElement && !isActionDisabled(node)
          ? Utils.openableLinkUrlForNode(node)
          : null;
      case 'text':
        return visibleText(node!);
      case 'select':
        Utils.selectNodeContents(node!);
        return true;
      case 'scroll':
        Utils.scrollToNodeAtIndexInList([node!], 0);
        return true;
      case 'activate':
      case 'focus':
        if (isActionDisabled(node!) || !(node instanceof HTMLElement)) return false;
        if (request.command === 'focus') {
          node.focus({ preventScroll: true });
          return Utils.elementIsActive(node);
        } else Utils.clickOrFocusNode(node);
        return true;
    }
  }
  const probe = (event: MessageEvent) => {
    if (
      !isTrustedInput(event) ||
      event.source !== window.parent ||
      !event.data ||
      event.data.type !== FRAME_PROBE ||
      !isFrameToken(event.data.token)
    )
      return;
    void send({ kind: 'hello', token: event.data.token });
  };
  const listener = (
    message: unknown,
    sender: Browser.runtime.MessageSender,
    respond: (value: unknown) => void,
  ) => {
    if (
      sender.id !== browser.runtime.id ||
      !isFrameEnvelope(message) ||
      message.kind !== 'deliver' ||
      !isFrameId(message.requester) ||
      !isFrameRequest(message.request)
    )
      return;
    void handle(message.request, message.requester).then(respond, () => respond(null));
    return true;
  };
  const key = (event: KeyboardEvent) => {
    if (
      !ready ||
      behavior === 'paused' ||
      !isTrustedInput(event) ||
      event.defaultPrevented ||
      event.isComposing ||
      event.getModifierState('AltGraph')
    )
      return;
    const opening = matchesOpeningShortcut(event, shortcut);
    const typing =
      behavior === 'type' &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      Utils.keyValidForFocus(event.key) &&
      !Utils.differentInputIsActive(null);
    if (!opening && !typing) return;
    event.preventDefault();
    event.stopPropagation();
    void send({ kind: 'open', text: opening ? '' : event.key });
  };
  const loadShortcut = () => {
    void send({ kind: 'configuration' }).then(value => {
      if (!disposed && isRecord(value)) {
        shortcut = parseOpeningShortcut(value.shortcut);
        behavior = parseSiteBehavior(value.behavior) ?? 'paused';
        ready = true;
      }
    });
  };
  // Page script can dispatch pagehide while the document stays open. Authenticated stop
  // commands and teardown still call stop() directly.
  const pagehide = (event: Event) => {
    if (isTrustedInput(event)) stop();
  };
  window.addEventListener('message', probe);
  window.parent.postMessage({ type: FRAME_PROBE, available: true }, '*');
  browser.runtime.onMessage.addListener(listener);
  browser.storage.onChanged.addListener(loadShortcut);
  document.addEventListener('keydown', key, true);
  window.addEventListener('scroll', refreshPaint, true);
  window.addEventListener('resize', refreshPaint);
  window.addEventListener('pagehide', pagehide);
  loadShortcut();
  return () => {
    disposed = true;
    stop();
    window.removeEventListener('message', probe);
    // An orphaned content script loses these APIs before it tears down.
    browser.runtime?.onMessage.removeListener(listener);
    browser.storage?.onChanged.removeListener(loadShortcut);
    document.removeEventListener('keydown', key, true);
    window.removeEventListener('scroll', refreshPaint, true);
    window.removeEventListener('resize', refreshPaint);
    window.removeEventListener('pagehide', pagehide);
  };
}
