import { useState, useCallback, useRef } from 'react';

export type ObserverRect = Omit<DOMRectReadOnly, 'toJSON'>;

export default function useResizeObserver() {
  const [rect, setRect] = useState<ObserverRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  // Callback ref replaces useRef + useEffect
  const ref = useCallback((node: HTMLElement | null) => {
    // Clean up previous observer if element unmounts or changes
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (node) {
      observerRef.current = new ResizeObserver(([entry]) => {
        setRect(entry.contentRect);
      });
      observerRef.current.observe(node);
    }
  }, []);

  return [ref, rect] as const;
}