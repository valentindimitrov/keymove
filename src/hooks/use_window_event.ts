import React from 'react';

function useWindowEvent<K extends keyof WindowEventMap>(
  effect: K,
  conditional: boolean,
  callback: (event: WindowEventMap[K]) => void,
) {
  return React.useEffect(() => {
    if (!conditional) {
      return undefined;
    }

    window.addEventListener(effect, callback);
    return () => window.removeEventListener(effect, callback);
  }, [effect, conditional, callback]);
}

export default useWindowEvent;
