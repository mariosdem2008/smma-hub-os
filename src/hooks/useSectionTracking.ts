import { useRef, useEffect } from 'react';
import { useInView } from 'framer-motion';
import { track } from '@/lib/analytics';

export const useSectionTracking = (sectionName: string, amount: number = 0.5) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount });

  useEffect(() => {
    if (isInView) {
      track('landing_section_view', { section: sectionName });
    }
  }, [isInView, sectionName]);

  return ref;
};
