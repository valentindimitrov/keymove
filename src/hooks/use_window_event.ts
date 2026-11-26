import React from 'react';

function useWindowEvent<K extends keyof WindowEventMap>(
  eventName: K,
  enabled: boolean,
  callback: (event: WindowEventMap[K]) => void,
  capture = false,
) {
  React.useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    window.addEventListener(eventName, callback, capture);
    return () => window.removeEventListener(eventName, callback, capture);
  }, [eventName, enabled, callback, capture]);
}

export default useWindowEvent;
