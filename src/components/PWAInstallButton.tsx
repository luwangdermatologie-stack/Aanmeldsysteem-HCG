import React, { useState } from 'react';
import { Download, Share, PlusSquare, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running as installed standalone app, hide button
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        id="btn-pwa-install"
        onClick={install}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium shadow-sm transition active:scale-95 cursor-pointer"
        title="Installeer applicatie als PWA"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Installeer App</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <div className="relative">
        <button
          id="btn-pwa-ios-install"
          onClick={() => setShowIOSGuide(!showIOSGuide)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-xs font-medium shadow-sm transition active:scale-95 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Installeer</span>
        </button>

        {showIOSGuide && (
          <div className="absolute right-0 top-full mt-2 w-72 rounded-xl bg-white p-4 shadow-xl border border-slate-200 text-slate-800 z-50 text-xs">
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100 font-semibold text-slate-900">
              <span>Installeren op iPad / iPhone:</span>
              <button 
                onClick={() => setShowIOSGuide(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <ol className="space-y-2 text-slate-600 text-[11px]">
              <li className="flex items-center gap-2">
                <span>1. Druk onderaan/bovenaan op de knop <strong>Delen</strong></span>
                <Share className="w-3.5 h-3.5 text-blue-500 inline shrink-0" />
              </li>
              <li className="flex items-center gap-2">
                <span>2. Kies <strong>Zet op beginscherm</strong></span>
                <PlusSquare className="w-3.5 h-3.5 text-emerald-500 inline shrink-0" />
              </li>
              <li>3. Tik rechtsboven op <strong>Voeg toe</strong>.</li>
            </ol>
          </div>
        )}
      </div>
    );
  }

  return null;
};
