import { useEffect, useState } from "react";

// Returns true on phone-sized viewports. Used to switch between the
// full-bleed mobile app and the desktop "device frame" presentation.
export function useIsMobile(breakpoint = 600): boolean {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [breakpoint]);
  return isMobile;
}
