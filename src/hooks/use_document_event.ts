import React from 'react';

function useDocumentEvent<K extends keyof DocumentEventMap>(
  eventName: K,
  enabled: boolean,
  callback: (event: DocumentEventMap[K]) => void,
  capture = false,
) {
  React.useEffect(() => {
    if (!enabled) {
      return undefined;
    }

    document.addEventListener(eventName, callback, capture);
    return () => document.removeEventListener(eventName, callback, capture);
  }, [eventName, enabled, callback, capture]);
}

export default useDocumentEvent;
