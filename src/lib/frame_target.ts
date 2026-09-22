import type { FrameCommand, FrameRow } from './frame_protocol.js';

// Detached DOM handles let the existing independent cursors retain identity across refreshes.
// They are never inserted into the page, searched, or treated as the actual remote control.
export type FrameTarget = {
  row: FrameRow;
  boundary: HTMLIFrameElement;
  alive: () => boolean;
  command: (command: FrameCommand) => Promise<unknown>;
  paint: (nodes: Element[], selected: Element | null, color: string, highlight: boolean) => void;
};
const targets = new WeakMap<Element, FrameTarget>();
export const frameTarget = (node: Element | null | undefined) =>
  node ? targets.get(node) : undefined;
export const setFrameTarget = (node: Element, target: FrameTarget) => targets.set(node, target);
export function resultIsConnected(node: Element | null | undefined): node is Element {
  return !!node && (frameTarget(node)?.alive() ?? node.isConnected);
}
export function paintFrameTargets(
  nodes: Element[],
  selected: Element | null,
  color: string,
  highlight = false,
) {
  const painters = new Set(
    nodes.map(node => frameTarget(node)?.paint).filter(fn => fn !== undefined),
  );
  for (const paint of painters) paint(nodes, selected, color, highlight);
  return () => {
    for (const paint of painters) paint([], null, color, false);
  };
}
