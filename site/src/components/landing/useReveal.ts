import { useEffect } from 'react';

/**
 * Scroll-reveal for elements with the `.reveal` class. Marks `<html>` with `.js`
 * so the hidden state only applies when JS can reveal it (no-JS shows everything),
 * then fades each element in as it enters the viewport. Falls back to revealing all
 * if IntersectionObserver is unavailable.
 */
export function useReveal() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add('js');
    const els = Array.from(document.querySelectorAll<HTMLElement>('.landing .reveal'));
    if (!('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
