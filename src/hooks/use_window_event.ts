import React from 'react';

function useWindowEvent<K extends keyof WindowEventMap>(
  eventName: K,
  enabled: boolean,
  callback: (event: WindowEventMap[K]) => void,
) {
  React.useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    window.addEventListener(eventName, callback);
    return () => window.removeEventListener(eventName, callback);
  }, [eventName, enabled, callback]);
}

export default useWindowEvent;
