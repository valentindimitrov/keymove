import React from 'react';

function useDocumentEvent(effect, conditional, callback, capture = false) {
  return React.useEffect(() => {
    if (!conditional) {
      return undefined;
    }

    document.addEventListener(effect, callback, capture);
    return () => document.removeEventListener(effect, callback, capture);
  }, [effect, conditional, callback, capture]);
}

export default useDocumentEvent;
