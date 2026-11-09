import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import ErrorBoundary from './ErrorBoundary.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker with automatic refresh & periodic update check for permanently open PCs
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('[PWA] Nieuwe versie gedetecteerd, actieve sessie vernieuwen naar nieuwste code...');
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      if (registration) {
        // Controleer periodiek (elke 5 minuten) of er een nieuwe build op GitHub staat
        setInterval(() => {
          registration.update().catch(() => {});
        }, 5 * 60 * 1000);
      }
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
