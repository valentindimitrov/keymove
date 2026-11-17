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
    // A resize between the first render's read and this subscription had no listener.
    // Re-read once, keeping the same object when nothing changed to avoid a re-render.
    setWindowSize(previous => {
      const current = getWindowDimensions();
      return current.width === previous.width && current.height === previous.height
        ? previous
        : current;
    });
    return () => {
      window.removeEventListener('resize', resize);
      window.clearTimeout(resizeTimeout);
    };
  }, [timeoutDuration]);

  return windowSize;
};

export default useWindowSize;
