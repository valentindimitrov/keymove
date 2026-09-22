import { browser, type Browser } from 'wxt/browser';
import {
  FRAME_MESSAGE,
  FRAME_PROBE,
  isFrameEnvelope,
  isFrameId,
  isFrameReply,
} from './frame_protocol.js';
import type { FrameReply, FrameRequest } from './frame_protocol.js';
import { frameTarget, setFrameTarget, resultIsConnected } from './frame_target.js';
import { pageShadowRoots } from './dom_tree.js';
import { activeModal, actionIsInScope } from './modal_context.js';
import { isTextVisible } from './visible_text.js';
import type { SearchResult, RankedMatch } from './page_search_index.js';
import { ACTION_PRIORITY_BOOST } from '../constants.js';

const empty = (): SearchResult => ({
  matchingText: [],
  matchingLinksAndButtons: [],
  suggestions: [],
  isFuzzy: false,
});
type Entry = {
  frame: HTMLIFrameElement;
  token: string;
  frameId?: number;
  generation: string;
  cached?: { query: string; result: SearchResult };
  nodes: Map<string, HTMLElement>;
  ready: Promise<void>;
  resolve: () => void;
  load: () => void;
  update?: (reply: FrameReply) => void;
  cancel?: () => void;
};

export function connectedFrameResults(results: SearchResult[]): SearchResult[] {
  return results.map(result => ({
    ...result,
    matchingText: result.matchingText.filter(match => resultIsConnected(match.node)),
    matchingLinksAndButtons: result.matchingLinksAndButtons.filter(resultIsConnected),
    suggestions: result.suggestions.filter(match => resultIsConnected(match.node)),
  }));
}

export function mergeFrameResults(results: SearchResult[]): SearchResult {
  // Exact matches anywhere win over fuzzy matches everywhere.
  const exact = results.some(
    result =>
      !result.isFuzzy && (result.matchingText.length || result.matchingLinksAndButtons.length),
  );
  const used = results.filter(result => !exact || !result.isFuzzy);
  return {
    matchingText: used.flatMap(result => result.matchingText),
    matchingLinksAndButtons: used.flatMap(result => result.matchingLinksAndButtons),
    suggestions: used.flatMap(result => result.suggestions).sort((a, b) => b.score - a.score),
    isFuzzy: !exact && used.some(result => result.isFuzzy),
  };
}

export class FrameSearch {
  private entries = new Map<HTMLIFrameElement, Entry>();
  private listening = false;
  constructor(private readonly changed: () => void) {}

  private readonly listener = (message: unknown, sender: Browser.runtime.MessageSender) => {
    if (sender.id !== browser.runtime.id || !isFrameEnvelope(message)) return;
    for (const entry of this.entries.values()) {
      if (message.kind === 'ready' && message.token === entry.token && isFrameId(message.frameId)) {
        if (entry.frameId === message.frameId) continue;
        entry.frameId = message.frameId;
        entry.resolve();
        this.changed();
      } else if (message.kind === 'changed' && message.source === entry.frameId) {
        this.changed();
      } else if (
        message.kind === 'results' &&
        message.source === entry.frameId &&
        isFrameReply(message.reply)
      ) {
        entry.update?.(message.reply);
      }
    }
  };

  private readonly available = (event: MessageEvent) => {
    if (event.data?.type !== FRAME_PROBE || event.data?.available !== true) return;
    for (const entry of this.entries.values())
      if (entry.frameId === undefined && event.source === entry.frame.contentWindow)
        entry.frame.contentWindow?.postMessage({ type: FRAME_PROBE, token: entry.token }, '*');
  };

  private eligible(frame: HTMLIFrameElement) {
    return (
      frame.isConnected &&
      isTextVisible(frame) &&
      frame.getClientRects().length > 0 &&
      actionIsInScope(frame, activeModal())
    );
  }

  private discover() {
    const frames = [document, ...pageShadowRoots()]
      .flatMap(root => [...root.querySelectorAll('iframe')])
      .filter(frame => this.eligible(frame));
    if (!frames.length && !this.entries.size) return [];
    if (!this.listening) {
      browser.runtime.onMessage.addListener(this.listener);
      window.addEventListener('message', this.available);
      this.listening = true;
    }
    for (const [frame, entry] of this.entries) {
      if (!frames.includes(frame)) {
        entry.cancel?.();
        void this.request(entry, { op: 'stop' });
        frame.removeEventListener('load', entry.load);
        entry.nodes.clear();
        this.entries.delete(frame);
      }
    }
    for (const frame of frames) {
      if (this.entries.has(frame)) continue;
      const readiness = Promise.withResolvers<void>();
      const entry: Entry = {
        frame,
        token: crypto.randomUUID(),
        generation: '',
        nodes: new Map(),
        ready: readiness.promise,
        resolve: readiness.resolve,
        load: () => {
          entry.cancel?.();
          delete entry.update;
          delete entry.frameId;
          entry.nodes.clear();
          delete entry.cached;
          entry.token = crypto.randomUUID();
          frame.contentWindow?.postMessage({ type: FRAME_PROBE, token: entry.token }, '*');
          this.changed();
        },
      };
      this.entries.set(frame, entry);
      frame.addEventListener('load', entry.load);
      frame.contentWindow?.postMessage({ type: FRAME_PROBE, token: entry.token }, '*');
    }
    return [...this.entries.values()];
  }

  private async request(entry: Entry, request: FrameRequest): Promise<unknown> {
    if (entry.frameId === undefined) return null;
    try {
      return await browser.runtime.sendMessage({
        type: FRAME_MESSAGE,
        kind: 'request',
        frameId: entry.frameId,
        request,
      });
    } catch {
      return null;
    }
  }

  private materialize(entry: Entry, reply: FrameReply): SearchResult {
    const keep = new Set<string>();
    const paint = (
      nodes: Element[],
      selected: Element | null,
      color: string,
      highlight: boolean,
    ) => {
      const own = nodes.filter(node => frameTarget(node)?.boundary === entry.frame);
      void this.request(entry, {
        op: 'paint',
        generation: reply.generation,
        ids: own.map(node => frameTarget(node)!.row.id),
        selected: selected && own.includes(selected) ? frameTarget(selected)!.row.id : null,
        color,
        highlight,
      });
    };
    for (const row of reply.rows) {
      const key = `${row.kind}:${row.id}`;
      keep.add(key);
      const node =
        entry.nodes.get(key) ??
        document.createElement(row.href ? 'a' : row.kind === 'action' ? 'button' : 'p');
      if (row.href) node.setAttribute('href', row.href);
      node.tabIndex = row.focusable ? 0 : -1;
      // Explicit metadata adapters, not DOM impersonation: all remote operations are
      // validated again by the owning frame before touching its real node.
      setFrameTarget(node, {
        row,
        boundary: entry.frame,
        alive: () =>
          this.entries.get(entry.frame) === entry &&
          entry.nodes.get(key) === node &&
          this.eligible(entry.frame),
        command: async command => {
          if (!this.eligible(entry.frame)) return null;
          if (command === 'scroll')
            entry.frame.scrollIntoView({ block: 'nearest', inline: 'nearest' });
          return this.request(entry, {
            op: 'command',
            generation: entry.generation,
            id: row.id,
            command,
          });
        },
        paint,
      });
      entry.nodes.set(key, node);
    }
    for (const key of entry.nodes.keys()) if (!keep.has(key)) entry.nodes.delete(key);
    const result = empty();
    result.isFuzzy = reply.isFuzzy;
    for (const row of reply.rows) {
      if (row.score <= 0) continue;
      const node = entry.nodes.get(`${row.kind}:${row.id}`)!;
      if (row.kind === 'action') result.matchingLinksAndButtons.push(node);
      else
        result.matchingText.push({
          node,
          action: row.action === null ? null : (entry.nodes.get(`action:${row.action}`) ?? null),
          score: row.score,
          term: row.term ?? '',
          distance: row.distance,
        });
      result.suggestions.push({
        node,
        kind: row.kind,
        score: row.score * (row.kind === 'action' ? ACTION_PRIORITY_BOOST : 1),
        term: row.term,
        distance: row.distance,
      } satisfies RankedMatch);
    }
    return result;
  }

  async search(
    query: string,
    signal: AbortSignal,
    publish: (results: SearchResult[]) => void,
    depth = 0,
  ) {
    if (depth >= 8) return [];
    const entries = this.discover();
    // A slow sibling must not temporarily disappear during a same-query refresh.
    const results = entries.map(entry =>
      entry.cached?.query === query ? entry.cached.result : empty(),
    );
    let next = 0;
    // Bound fan-out rather than giving every iframe a simultaneous work budget.
    await Promise.all(
      Array.from({ length: Math.min(2, entries.length) }, async () => {
        while (next < entries.length && !signal.aborted) {
          const index = next++;
          const entry = entries[index]!;
          entry.cancel?.();
          const generation = crypto.randomUUID();
          entry.generation = generation;
          let streamed = false;
          const accept = (reply: FrameReply) => {
            if (
              signal.aborted ||
              entry.generation !== generation ||
              reply.generation !== generation ||
              this.entries.get(entry.frame) !== entry ||
              !this.eligible(entry.frame)
            )
              return;
            results[index] = this.materialize(entry, reply);
            entry.cached = { query, result: results[index]! };
            publish([...results]);
          };
          entry.update = reply => {
            if (reply.generation !== generation) return;
            streamed = true;
            accept(reply);
          };
          const cancel = () => {
            signal.removeEventListener('abort', cancel);
            if (entry.generation === generation) {
              delete entry.update;
              delete entry.cancel;
              void this.request(entry, { op: 'cancel', generation });
            }
          };
          entry.cancel = cancel;
          signal.addEventListener('abort', cancel, { once: true });
          let timeout: ReturnType<typeof setTimeout> | undefined;
          let expired = false;
          try {
            const reply = await Promise.race([
              (async () => {
                if (entry.frameId === undefined) await entry.ready;
                if (signal.aborted || expired) return null;
                return this.request(entry, { op: 'search', query, generation, depth: depth + 1 });
              })(),
              new Promise<null>(resolve => {
                timeout = setTimeout(() => {
                  expired = true;
                  entry.resolve();
                  resolve(null);
                }, 1500);
              }),
            ]);
            if (signal.aborted || entry.generation !== generation || streamed) continue;
            if (
              isFrameReply(reply) &&
              reply.generation === generation &&
              this.eligible(entry.frame)
            ) {
              accept(reply);
            } else {
              delete entry.update;
              results[index] = empty();
              delete entry.cached;
              entry.nodes.clear();
              cancel();
              publish([...results]);
            }
          } finally {
            clearTimeout(timeout);
          }
        }
      }),
    );
    return results;
  }

  stop() {
    for (const entry of this.entries.values()) {
      entry.cancel?.();
      void this.request(entry, { op: 'stop' });
      entry.nodes.clear();
      entry.frame.removeEventListener('load', entry.load);
    }
    this.entries.clear();
    if (this.listening) browser.runtime.onMessage.removeListener(this.listener);
    window.removeEventListener('message', this.available);
    this.listening = false;
  }
  restore() {
    for (const entry of this.entries.values()) void this.request(entry, { op: 'restore' });
  }
}
