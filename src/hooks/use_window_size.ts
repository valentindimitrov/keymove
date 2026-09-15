import React from 'react';

function getWindowDimensions() {
  // innerWidth includes classic scrollbars; fixed UI must fit the space beside them.
  const width = document.documentElement.clientWidth || window.innerWidth;
  return { height: window.innerHeight, width };
}

const useWindowSize = (timeoutDuration = 0) => {
  const [windowSize, setWindowSize] = React.useState(getWindowDimensions);

  React.useEffect(() => {
    let resizeTimeout: number | undefined;
    const resize = () => {
      window.clearTimeout(resizeTimeout);
      if (timeoutDuration === 0) {
        setWindowSize(getWindowDimensions());
      } else {
        resizeTimeout = window.setTimeout(
          () => setWindowSize(getWindowDimensions()),
          timeoutDuration,
        );
      }
    };

    window.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.clearTimeout(resizeTimeout);
    };
  }, [timeoutDuration]);

  return windowSize;
};

export default useWindowSize;
