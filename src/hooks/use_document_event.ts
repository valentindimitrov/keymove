import React from 'react';

function useDocumentEvent<K extends keyof DocumentEventMap>(
  effect: K,
  conditional: boolean,
  callback: (event: DocumentEventMap[K]) => void,
  capture = false,
) {
  return React.useEffect(() => {
    if (!conditional) {
      return undefined;
    }

    document.addEventListener(effect, callback, capture);
    return () => document.removeEventListener(effect, callback, capture);
  }, [effect, conditional, callback, capture]);
}

export default useDocumentEvent;
