import React from 'react';
import { RefreshCw, Sparkles } from 'lucide-react';
import { useAutoUpdate } from '../hooks/useAutoUpdate';

export const UpdateNotificationBanner: React.FC = () => {
  const { hasUpdate, reloadApp } = useAutoUpdate();

  if (!hasUpdate) return null;

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-50 animate-bounce-subtle">
      <div className="bg-indigo-900 text-white px-4 py-2 rounded-xl shadow-2xl border border-indigo-700/80 flex items-center gap-3 text-xs sm:text-sm font-medium">
        <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
        <span>Nieuwe app-versie beschikbaar op GitHub!</span>
        <button
          type="button"
          onClick={reloadApp}
          className="flex items-center gap-1.5 px-3 py-1 bg-white hover:bg-slate-100 text-indigo-950 font-bold rounded-lg text-xs transition active:scale-95 cursor-pointer shadow-sm"
        >
          <RefreshCw className="h-3.5 w-3.5 text-indigo-600 animate-spin" />
          <span>Nu Vernieuwen</span>
        </button>
      </div>
    </div>
  );
};
