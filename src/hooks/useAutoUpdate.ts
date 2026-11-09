import { useEffect, useState, useCallback } from 'react';

export function useAutoUpdate() {
  const [hasUpdate, setHasUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string | null>(null);

  const reloadApp = useCallback(async () => {
    try {
      // Unregister service worker and clear caches to guarantee fresh bundle
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.update();
        }
      }
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(cacheKeys.map(k => caches.delete(k)));
      }
    } catch (e) {
      console.warn('Cache clear error during reload:', e);
    }
    // Hard reload
    window.location.reload();
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Fetch initial version
    fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (isMounted && data?.buildTime) {
          setCurrentVersion(data.buildTime);
        }
      })
      .catch(() => {});

    // Periodic check every 5 minutes (300,000 ms) for screens open 24/7
    const interval = setInterval(() => {
      fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
        .then(res => res.json())
        .then(data => {
          if (!isMounted || !data?.buildTime) return;
          setCurrentVersion(prev => {
            if (prev && prev !== data.buildTime) {
              console.log('[AutoUpdate] Newer build timestamp detected:', data.buildTime);
              setHasUpdate(true);
            }
            return prev || data.buildTime;
          });
        })
        .catch(() => {});
    }, 5 * 60 * 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return {
    hasUpdate,
    currentVersion,
    reloadApp
  };
}
