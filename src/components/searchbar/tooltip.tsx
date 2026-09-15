import React from 'react';
import Utils from '../../lib/utils.js';
import Portal from './portal.js';
import useWindowSize from '../../hooks/use_window_size.js';

const ARROW_SIZE = 15;

type TooltipProps = React.PropsWithChildren<{
  containerRef: React.RefObject<HTMLElement | null>;
}>;

const Tooltip = (props: TooltipProps) => {
  const { children, containerRef } = props;

  const [hasMounted, setHasMounted] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  const windowSize = useWindowSize(100);

  const style = React.useMemo<{ panel: React.CSSProperties; arrow: React.CSSProperties }>(() => {
    if (!containerRef.current || !panelRef.current || !hasMounted) {
      return {
        panel: { opacity: 0 },
        arrow: { opacity: 0 },
      };
    } else {
      const containerBounds = containerRef.current.getBoundingClientRect();
      const containerDistanceFromBottom = windowSize.height - containerBounds.bottom;
      const panelBounds = panelRef.current.getBoundingClientRect();
      const totalTooltipHeight = panelBounds.height + ARROW_SIZE;

      let panelTop, arrowTop, arrowBorderWidth;
      if (totalTooltipHeight > containerDistanceFromBottom) {
        panelTop = containerBounds.top - panelBounds.height - ARROW_SIZE;
        arrowTop = containerBounds.top - ARROW_SIZE;
        arrowBorderWidth = `${ARROW_SIZE}px ${ARROW_SIZE}px 0 ${ARROW_SIZE}px`;
      } else {
        panelTop = containerBounds.bottom + ARROW_SIZE;
        arrowTop = containerBounds.bottom;
        arrowBorderWidth = `0 ${ARROW_SIZE}px ${ARROW_SIZE}px ${ARROW_SIZE}px`;
      }

      const centeredPanelLeft = Math.round(
        containerBounds.left + containerBounds.width / 2 - panelBounds.width / 2,
      );
      const centeredArrowLeft = Math.round(
        containerBounds.left + containerBounds.width / 2 - ARROW_SIZE,
      );

      const maxPanelLeft = Math.max(0, windowSize.width - panelBounds.width);
      const panelLeft = Utils.clampNumber(centeredPanelLeft, 0, maxPanelLeft);

      const maxArrowLeft = windowSize.width - ARROW_SIZE;
      const arrowLeft = Utils.clampNumber(centeredArrowLeft, ARROW_SIZE, maxArrowLeft);

      return {
        panel: {
          left: panelLeft,
          top: Utils.clampNumber(panelTop, 0, Math.max(0, windowSize.height - panelBounds.height)),
        },
        arrow: { left: arrowLeft, top: arrowTop, borderWidth: arrowBorderWidth },
      };
    }
  }, [hasMounted, windowSize, containerRef]);

  React.useEffect(() => setHasMounted(true), []);

  return (
    <div>
      <Portal>
        <div className={'keymove-tooltip-panel'} style={style.panel} ref={panelRef}>
          {children}
        </div>
      </Portal>
      <Portal>
        <div className={'keymove-tooltip-arrow'} style={style.arrow}></div>
      </Portal>
    </div>
  );
};

export default Tooltip;
