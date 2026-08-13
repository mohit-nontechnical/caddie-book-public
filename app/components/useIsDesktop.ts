import { useEffect, useState } from "react";

// Returns whether the viewport is desktop-sized (>= 1024px), plus a `ready`
// flag that flips true once the effect has run on the client. SSR-safe:
// the initial state is always false so server and first client render match.
// Callers should use `ready` to avoid flashing the mobile shell before the
// real match is known (e.g. render nothing / a neutral loading state until
// ready is true).
export function useIsDesktop(breakpoint = 1024): { isDesktop: boolean; ready: boolean } {
  const [isDesktop, setIsDesktop] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${breakpoint}px)`);
    const update = () => setIsDesktop(mq.matches);
    update();
    setReady(true);
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);

  return { isDesktop, ready };
}
