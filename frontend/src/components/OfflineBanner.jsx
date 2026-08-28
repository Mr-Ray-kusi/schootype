import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import { listPending, subscribeOffline, syncPending } from '../utils/offlineQueue';
import axios from 'axios';
import toast from 'react-hot-toast';
import { invalidateCache } from '../utils/requestCache';

const OfflineBanner = () => {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0);
  const [syncing, setSyncing] = useState(false);

  const refreshPending = async () => {
    const items = await listPending();
    setPending(items.length);
  };

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const unsub = subscribeOffline(refreshPending);
    refreshPending();
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      unsub();
    };
  }, []);

  useEffect(() => {
    if (!online || pending === 0) return undefined;
    let cancelled = false;
    (async () => {
      setSyncing(true);
      try {
        const result = await syncPending(axios);
        if (!cancelled && result.synced) {
          invalidateCache();
          toast.success(`Synced ${result.synced} offline ${result.synced === 1 ? 'change' : 'changes'}`);
        }
      } catch {
        // stay queued
      } finally {
        if (!cancelled) setSyncing(false);
        refreshPending();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [online, pending]);

  if (online && pending === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
      <span className="inline-flex items-center gap-2">
        {!online ? <WifiOff className="h-4 w-4" /> : <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />}
        {!online
          ? `Offline mode — ${pending} change${pending === 1 ? '' : 's'} saved on this device`
          : `Syncing ${pending} offline change${pending === 1 ? '' : 's'}…`}
      </span>
    </div>
  );
};

export default OfflineBanner;
