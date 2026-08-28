import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/authcontext';

const HEARTBEAT_MS = 45000;
const SLOW_PAGE_MS = 3000;
const TELEMETRY_URL = '/api/telemetry';

const sendQueue = [];
let flushTimer = null;

function flushTelemetry() {
  if (!sendQueue.length) return;
  const events = sendQueue.splice(0, sendQueue.length);
  axios.post(TELEMETRY_URL, { events, schoolName: events[0]?.schoolName }).catch(() => {});
}

function enqueueEvent(event) {
  sendQueue.push(event);
  if (sendQueue.length >= 8) {
    flushTelemetry();
    return;
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushTelemetry();
  }, 400);
}

function isTelemetryUrl(url) {
  return String(url || '').includes('/api/telemetry');
}

/**
 * Records page views, heartbeats (active users), and pages slower than 3s.
 */
export default function usePlatformTelemetry() {
  const { token, school } = useAuth();
  const location = useLocation();
  const pageStartedAt = useRef(typeof performance !== 'undefined' ? performance.now() : Date.now());
  const slowSentForPath = useRef(false);

  useEffect(() => {
    if (!token || !school) return undefined;

    const base = {
      schoolName: school.name || null,
      path: location.pathname,
    };

    pageStartedAt.current = typeof performance !== 'undefined' ? performance.now() : Date.now();
    slowSentForPath.current = false;
    enqueueEvent({ type: 'page_view', ...base });

    const markSlowIfNeeded = (durationMs) => {
      if (slowSentForPath.current || durationMs < SLOW_PAGE_MS) return;
      slowSentForPath.current = true;
      enqueueEvent({ type: 'page_slow', durationMs: Math.round(durationMs), ...base });
    };

    const idleTimer = setTimeout(() => {
      const elapsed =
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - pageStartedAt.current;
      markSlowIfNeeded(elapsed);
    }, SLOW_PAGE_MS + 200);

    const requestId = axios.interceptors.request.use((config) => {
      if (!isTelemetryUrl(config.url)) {
        config._pageTelemetryStart = typeof performance !== 'undefined' ? performance.now() : Date.now();
      }
      return config;
    });

    const responseId = axios.interceptors.response.use(
      (response) => {
        const started = response.config?._pageTelemetryStart;
        if (started) {
          const durationMs =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
          if (durationMs >= SLOW_PAGE_MS) {
            markSlowIfNeeded(durationMs);
          }
        }
        return response;
      },
      (error) => {
        const started = error?.config?._pageTelemetryStart;
        if (started) {
          const durationMs =
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
          if (durationMs >= SLOW_PAGE_MS) markSlowIfNeeded(durationMs);
        }
        return Promise.reject(error);
      }
    );

    return () => {
      clearTimeout(idleTimer);
      axios.interceptors.request.eject(requestId);
      axios.interceptors.response.eject(responseId);
    };
  }, [token, school, location.pathname]);

  useEffect(() => {
    if (!token || !school) return undefined;

    const beat = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      enqueueEvent({
        type: 'heartbeat',
        schoolName: school.name || null,
        path: location.pathname,
      });
    };

    beat();
    const id = setInterval(beat, HEARTBEAT_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') beat();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      flushTelemetry();
    };
  }, [token, school, location.pathname]);
}
