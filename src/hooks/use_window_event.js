import React from 'react';

function useWindowEvent(effect, conditional, callback) {
  return React.useEffect(() => {
    if (!conditional) {
      return undefined;
    }

    window.addEventListener(effect, callback)
    return () => window.removeEventListener(effect, callback)
  }, [effect, conditional, callback])
}

export default useWindowEvent;
