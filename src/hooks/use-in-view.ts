import { useEffect, useState } from "react";

type UseInViewOptions = {
  /** Grows the viewport, e.g. "200px" fires slightly before the element is visible. */
  rootMargin?: string;
};

/**
 * Tracks whether an element is in the viewport, using IntersectionObserver.
 * Returns a callback ref (so a re-mounted element is observed again) and a
 * boolean. Generic: it knows nothing about tasks or data fetching.
 */
export function useInView<T extends Element>({ rootMargin = "0px" }: UseInViewOptions = {}) {
  const [element, setElement] = useState<T | null>(null);
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsIntersecting(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(element);
    // Disconnect on unmount and whenever the element or margin changes.
    return () => observer.disconnect();
  }, [element, rootMargin]);

  // An unmounted element is never in view, even if its last reading was true.
  return { ref: setElement, inView: element !== null && isIntersecting };
}
