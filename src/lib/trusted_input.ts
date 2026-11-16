// Page script shares the DOM with every content script, so it can dispatch keydown, input,
// copy and click events at KeyMove's listeners and reach its open shadow root. Only events
// the browser generated from real input are trusted; page-dispatched ones never are.

type InputEventLike = Event | { nativeEvent: Event };

// jsdom and Testing Library can only dispatch untrusted events. The test setup is the only
// code that changes this; the page cannot reach content-script module state.
let acceptSyntheticInput = false;

/** Test seam: accept synthetic events as though the browser had generated them. */
export function acceptSyntheticInputForTesting(accept: boolean) {
  acceptSyntheticInput = accept;
}

/** True only for input the browser generated, never for page-dispatched events. */
export function isTrustedInput(event: InputEventLike): boolean {
  const native = 'nativeEvent' in event ? event.nativeEvent : event;
  return native.isTrusted || acceptSyntheticInput;
}

/** Wraps a handler so untrusted events never reach it. */
export function trusted<E extends InputEventLike, A extends unknown[]>(
  handler: (event: E, ...args: A) => void,
) {
  return (event: E, ...args: A) => {
    if (isTrustedInput(event)) handler(event, ...args);
  };
}

/**
 * Whether this frame has transient user activation, required before KeyMove activates a
 * result or requests a tab. Activation belongs to the frame that received the input and
 * propagates only to ancestors, so a child frame running a relayed command never has it;
 * the top frame checks it before sending the command. Browsers without the API rely on
 * the trusted-event checks alone.
 */
export function hasUserActivation(): boolean {
  const activation = (navigator as Navigator & { userActivation?: { isActive: boolean } })
    .userActivation;
  return activation === undefined || activation.isActive;
}
