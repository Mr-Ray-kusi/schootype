import { lazy } from 'react';

const CHUNK_RELOAD_KEY = 'schootype-chunk-reload';

export function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return (
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('error loading dynamically imported module') ||
    message.includes('Importing a module script failed')
  );
}

export function lazyWithRetry(importer) {
  return lazy(async () => {
    try {
      const mod = await importer();
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return mod;
    } catch (error) {
      if (isChunkLoadError(error) && !sessionStorage.getItem(CHUNK_RELOAD_KEY)) {
        sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
        window.location.reload();
        return new Promise(() => {});
      }
      sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      throw error;
    }
  });
}
