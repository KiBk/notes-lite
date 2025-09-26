import { useEffect, useRef } from 'react';

export function useMasonryItem({ minSpan = 1 } = {}) {
  const localRef = useRef(null);

  useEffect(() => {
    const element = localRef.current;
    if (!element || typeof window === 'undefined') {
      return undefined;
    }

    const grid = element.parentElement;
    if (!grid) {
      return undefined;
    }

    const computeSpan = () => {
      if (!grid || !element) {
        return;
      }
      const styles = window.getComputedStyle(grid);
      const rowHeightValue = parseFloat(styles.getPropertyValue('--masonry-row-height'))
        || parseFloat(styles.getPropertyValue('grid-auto-rows'))
        || 12;
      const gapValue = parseFloat(styles.getPropertyValue('row-gap') || styles.getPropertyValue('gap')) || 16;
      const height = element.getBoundingClientRect().height;
      const span = Math.max(minSpan, Math.ceil((height + gapValue) / (rowHeightValue + gapValue)));
      element.style.setProperty('--card-row-span', span);
    };

    computeSpan();

    let resizeObserver;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => computeSpan());
      resizeObserver.observe(element);
    }

    const handleResize = () => computeSpan();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [minSpan]);

  return localRef;
}
