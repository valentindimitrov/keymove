import React from 'react';

const useUrlChangeSubscription = () => {
  const [host, setHost] = React.useState(window.location.host);

  React.useEffect(() => {
    const pushState = window.history.pushState;
    const replaceState = window.history.replaceState;
    const updateHost = () => setHost(window.location.host);

    const wrappedPushState = function () {
      pushState.apply(window.history, arguments);
      updateHost()
    };

    const wrappedReplaceState = function () {
      replaceState.apply(window.history, arguments);
      updateHost()
    };

    window.history.pushState = wrappedPushState;
    window.history.replaceState = wrappedReplaceState;
    window.addEventListener('popstate', updateHost);

    return () => {
      if (window.history.pushState === wrappedPushState) {
        window.history.pushState = pushState;
      }
      if (window.history.replaceState === wrappedReplaceState) {
        window.history.replaceState = replaceState;
      }
      window.removeEventListener('popstate', updateHost);
    }
  }, [])

  return { host }
}

export default useUrlChangeSubscription;
