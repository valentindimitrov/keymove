import React from 'react';

const useUrlChangeSubscription = () => {
  const [host, setHost] = React.useState(window.location.host);

  React.useEffect(() => {
    const pushState = window.history.pushState;
    const replaceState = window.history.replaceState;
    const updateHost = () => setHost(window.location.host);

    const wrappedPushState: History['pushState'] = function (data, unused, url) {
      pushState.call(window.history, data, unused, url);
      updateHost();
    };

    const wrappedReplaceState: History['replaceState'] = function (data, unused, url) {
      replaceState.call(window.history, data, unused, url);
      updateHost();
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
    };
  }, []);

  return { host };
};

export default useUrlChangeSubscription;
