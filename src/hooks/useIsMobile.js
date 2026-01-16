// FILE: src/hooks/useIsMobile.js
import { useEffect, useState } from "react";

/**
 * Returns true when viewport width <= breakpoint (default 640px).
 * Why: inline styles can't use CSS media queries; we switch layouts in JS.
 */
export function useIsMobile(breakpointPx = 640) {
  const get = () =>
    typeof window !== "undefined" ? window.innerWidth <= breakpointPx : false;

  const [isMobile, setIsMobile] = useState(get);

  useEffect(() => {
    const onResize = () => setIsMobile(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [breakpointPx]);

  return isMobile;
}