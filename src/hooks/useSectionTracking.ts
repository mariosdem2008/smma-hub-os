import { useRef, useEffect } from 'react';
import { useInView } from 'framer-motion';

export const useSectionTracking = (sectionName: string, amount: number = 0.5) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount });

  useEffect(() => {
    if (isInView) {
      console.log(`Section Scroll: ${sectionName} - Entered Viewport`);
    }
  }, [isInView, sectionName]);

  return ref;
};
