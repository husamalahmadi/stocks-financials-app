// FILE: client/src/hooks/usePrefetchDelay.js
import { useEffect, useState } from "react";

/**
 * Delay before starting TwelveData fetches.
 * resetToken (ticker) restarts timer when user navigates to a new stock.
 *
 * @param {number} delayMs
 * @param {string|number} resetToken
 * @returns {{ready: boolean, secondsLeft: number}}
 */
export function usePrefetchDelay(delayMs, resetToken) {
  const ms = Number.isFinite(Number(delayMs)) ? Number(delayMs) : 5000;

  const [ready, setReady] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.ceil(ms / 1000));

  useEffect(() => {
    setReady(false);
    setSecondsLeft(Math.ceil(ms / 1000));

    const endAt = Date.now() + ms;

    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
      setSecondsLeft(left);

      if (left <= 0) {
        clearInterval(id);
        setReady(true);
      }
    }, 250);

    return () => clearInterval(id);
  }, [ms, resetToken]);

  return { ready, secondsLeft };
}