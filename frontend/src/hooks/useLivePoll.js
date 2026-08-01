import { useEffect, useRef } from 'react';

/**
 * Poll a callback on an interval without stacking overlapping runs.
 * Skips ticks while the tab is hidden to avoid flooding the API.
 * @param {() => void | Promise<void>} callback
 * @param {number} intervalMs
 * @param {boolean} enabled
 */
export function useLivePoll(callback, intervalMs = 20000, enabled = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      inFlight = true;
      try {
        await cbRef.current();
      } catch {
        // Callers handle their own errors; keep polling.
      } finally {
        inFlight = false;
      }
    };

    const id = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [intervalMs, enabled]);
}

export default useLivePoll;
