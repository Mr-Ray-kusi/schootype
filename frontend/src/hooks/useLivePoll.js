import { useEffect, useRef } from 'react';

/**
 * Poll a callback on an interval without stacking overlapping runs.
 * @param {() => void | Promise<void>} callback
 * @param {number} intervalMs
 * @param {boolean} enabled
 */
export function useLivePoll(callback, intervalMs = 8000, enabled = true) {
  const cbRef = useRef(callback);
  cbRef.current = callback;

  useEffect(() => {
    if (!enabled || !intervalMs) return undefined;

    let cancelled = false;
    let inFlight = false;

    const tick = async () => {
      if (cancelled || inFlight) return;
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
    const onFocus = () => tick();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, [intervalMs, enabled]);
}

export default useLivePoll;
