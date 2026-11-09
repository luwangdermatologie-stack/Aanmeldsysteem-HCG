/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ActiveStaff, Timesheet, SystemConfig } from '../types';
import { 
  Clock, 
  CheckCircle2, 
  LogOut, 
  LogIn, 
  User, 
  Users, 
  Calendar, 
  History, 
  Smartphone, 
  Share2, 
  QrCode, 
  Copy, 
  Check, 
  ChevronRight, 
  RefreshCw, 
  Plus, 
  ArrowLeft, 
  Shield, 
  Sparkles, 
  AlertCircle, 
  Coffee,
  X,
  ExternalLink,
  Wifi,
  WifiOff,
  Trash2
} from 'lucide-react';
import QRCode from 'qrcode';
import { getDetectedEnvironment } from '../config/environment';
import { 
  getBelgianDateString, 
  formatBelgianTimeHM, 
  formatBelgianTimeHMS, 
  getBelgianHour, 
  parseBelgianDateTimeToIso, 
  formatBelgianFullDate, 
  formatBelgianShortDate 
} from '../services/belgianTime';

interface MobileTimesheetAppProps {
  activeStaffList: ActiveStaff[];
  timesheets: Timesheet[];
  systemConfig: SystemConfig;
  onUpdateTimesheet: (timesheet: Timesheet) => Promise<void> | void;
  onDeleteTimesheet?: (id: string) => Promise<void> | void;
  onOpenAdmin?: () => void;
  onOpenAdminWithPin?: () => void;
  onSwitchView?: (view: 'kiosk' | 'admin' | 'split' | 'tiktijden') => void;
}

// Simple Web Audio synthesizer for pleasant mobile click/success sounds
function playMobileSound(type: 'in' | 'out' | 'tap') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;
    if (type === 'in') {
      // Cheerful ascending chime (clock in)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4
      osc.frequency.exponentialRampToValueAtTime(659.25, now + 0.12); // E5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.25); // A5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'out') {
      // Pleasant descending chime (clock out)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.12); // C5
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.25); // A4
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else {
      // Subtle tap
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    }

    // Mobile haptic vibration if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      if (type === 'in') navigator.vibrate([40, 30, 60]);
      else if (type === 'out') navigator.vibrate([60, 40, 40]);
      else navigator.vibrate(20);
    }
  } catch {
    // Audio context may be restricted by browser policy before first interaction
  }
}

export default function MobileTimesheetApp({
  activeStaffList,
  timesheets,
  systemConfig,
  onUpdateTimesheet,
  onDeleteTimesheet,
  onOpenAdmin,
  onOpenAdminWithPin,
  onSwitchView
}: MobileTimesheetAppProps) {
  // 1. Selected Staff Member persistence
  const [selectedStaffId, setSelectedStaffId] = useState<string>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const staffFromUrl = urlParams.get('staff') || urlParams.get('staffId');
      if (staffFromUrl && activeStaffList.some(s => s.id === staffFromUrl)) {
        return staffFromUrl;
      }
      const stored = localStorage.getItem('hcg_mobile_staff_id');
      if (stored && activeStaffList.some(s => s.id === stored)) {
        return stored;
      }
    } catch {
      // fallback
    }
    // Default to first staff member if available or empty to prompt selection
    return activeStaffList[0]?.id || '';
  });

  // Keep localStorage in sync when selected staff changes
  useEffect(() => {
    if (selectedStaffId) {
      try {
        localStorage.setItem('hcg_mobile_staff_id', selectedStaffId);
      } catch {
        // ignore
      }
    }
  }, [selectedStaffId]);

  // Current active staff object
  const currentStaff = useMemo(() => {
    return activeStaffList.find(s => s.id === selectedStaffId) || null;
  }, [activeStaffList, selectedStaffId]);

  // Active view tab in mobile app
  const [mobileTab, setMobileTab] = useState<'clock' | 'history' | 'team'>('clock');

  // Real-time clock state for digital clock display
  const [currentTime, setCurrentTime] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Format today's date string: YYYY-MM-DD in Belgian local time
  const todayStr = useMemo(() => {
    return getBelgianDateString(currentTime);
  }, [currentTime]);

  // Network connection state
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Environment detection (Live GitHub vs Preview)
  const currentEnv = getDetectedEnvironment();
  const isProd = currentEnv === 'production';

  // Check if selected staff is currently clocked in today
  const activeOpenTimesheet = useMemo(() => {
    if (!selectedStaffId) return null;
    return timesheets.find(
      ts => ts.staffId === selectedStaffId && ts.date === todayStr && !ts.clockOut
    ) || null;
  }, [timesheets, selectedStaffId, todayStr]);

  const isClockedIn = !!activeOpenTimesheet;

  // Calculate duration of current open shift
  const currentShiftDurationStr = useMemo(() => {
    if (!activeOpenTimesheet) return null;
    const startMs = new Date(activeOpenTimesheet.clockIn).getTime();
    const nowMs = currentTime.getTime();
    const diffMins = Math.max(0, Math.floor((nowMs - startMs) / (1000 * 60)));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hours === 0) {
      return `${mins} min`;
    }
    return `${hours}u ${mins < 10 ? '0' : ''}${mins}m`;
  }, [activeOpenTimesheet, currentTime]);

  // All timesheets for today for this staff member
  const todayTimesheets = useMemo(() => {
    if (!selectedStaffId) return [];
    return timesheets
      .filter(ts => ts.staffId === selectedStaffId && ts.date === todayStr)
      .sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  }, [timesheets, selectedStaffId, todayStr]);

  // Total worked time today in minutes & formatted string
  const totalWorkedTodayFormatted = useMemo(() => {
    let totalMinutes = 0;
    todayTimesheets.forEach(ts => {
      const startMs = new Date(ts.clockIn).getTime();
      const endMs = ts.clockOut ? new Date(ts.clockOut).getTime() : currentTime.getTime();
      const diffMins = Math.max(0, Math.floor((endMs - startMs) / (1000 * 60)));
      totalMinutes += diffMins;
    });
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${hours}u ${mins < 10 ? '0' : ''}${mins}m`;
  }, [todayTimesheets, currentTime]);

  // Feedback toast message
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Switch Staff Modal state
  const [isSwitchStaffOpen, setIsSwitchStaffOpen] = useState(false);

  // Manual Add Time Modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualDate, setManualDate] = useState(todayStr);
  const [manualIn, setManualIn] = useState('08:30');
  const [manualOut, setManualOut] = useState('17:00');

  // Share / QR Code Modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Install PWA Prompt state
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  // Compute direct smartphone link URL (with environment parameter to keep phone and PC aligned)
  const mobileAppUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const base = window.location.origin + window.location.pathname;
    const envParam = currentEnv ? `&env=${currentEnv}` : '';
    return `${base}?view=tiktijden${envParam}`;
  }, [currentEnv]);

  // Generate QR code when share modal opens
  useEffect(() => {
    if (isShareModalOpen && mobileAppUrl) {
      QRCode.toDataURL(mobileAppUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      })
        .then(url => setQrCodeDataUrl(url))
        .catch(err => console.error("QR Code generation error:", err));
    }
  }, [isShareModalOpen, mobileAppUrl]);

  // CLOCK IN ACTION
  const handleClockIn = async () => {
    if (!currentStaff) {
      setIsSwitchStaffOpen(true);
      return;
    }

    const now = new Date();
    const dateStr = getBelgianDateString(now);
    const timeHM = formatBelgianTimeHM(now);
    const newTimesheet: Timesheet = {
      id: `ts-${Date.now()}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      clockIn: now.toISOString(),
      clockOut: null,
      date: dateStr
    };

    playMobileSound('in');
    try {
      await onUpdateTimesheet(newTimesheet);
      showToast(`✓ Goedemorgen ${currentStaff.name}! Je bent succesvol ingeklokt om ${timeHM}.`, 'success');
    } catch (err) {
      console.error("Error clocking in:", err);
      showToast("Fout bij inklokken. Controleer uw internetverbinding.", "error");
    }
  };

  // CLOCK OUT ACTION
  const handleClockOut = async () => {
    if (!currentStaff) return;
    if (!activeOpenTimesheet) {
      showToast("Je bent momenteel niet ingeklokt.", "info");
      return;
    }

    const now = new Date();
    const timeHM = formatBelgianTimeHM(now);
    const updatedTimesheet: Timesheet = {
      ...activeOpenTimesheet,
      clockOut: now.toISOString()
    };

    playMobileSound('out');
    try {
      await onUpdateTimesheet(updatedTimesheet);
      showToast(`✓ Prettige dag ${currentStaff.name}! Je bent uitgeklokt om ${timeHM}.`, 'success');
    } catch (err) {
      console.error("Error clocking out:", err);
      showToast("Fout bij uitklokken. Controleer uw verbinding.", "error");
    }
  };

  // Submit manual time
  const handleSaveManualTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStaff || !manualDate || !manualIn) {
      showToast("Vul minstens datum en intiktijd in.", "info");
      return;
    }

    if (manualOut && manualOut <= manualIn) {
      showToast("Uittiktijd moet na intiktijd liggen.", "error");
      return;
    }

    const newTs: Timesheet = {
      id: `ts-${Date.now()}`,
      staffId: currentStaff.id,
      staffName: currentStaff.name,
      clockIn: parseBelgianDateTimeToIso(manualDate, manualIn),
      clockOut: manualOut ? parseBelgianDateTimeToIso(manualDate, manualOut) : null,
      date: manualDate
    };

    playMobileSound('tap');
    try {
      await onUpdateTimesheet(newTs);
      setIsManualModalOpen(false);
      showToast("✓ Tiktijd succesvol geregistreerd!", "success");
    } catch (err) {
      showToast("Opslaan mislukt.", "error");
    }
  };

  // Copy link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(mobileAppUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
      showToast("Link gekopieerd naar klembord!", "success");
    } catch {
      showToast("Kopiëren mislukt", "info");
    }
  };

  // PWA Install trigger
  const handleTriggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        showToast("App succesvol geïnstalleerd op uw smartphone!", "success");
      }
    } else {
      setIsInstallModalOpen(true);
    }
  };

  // Format hours/minutes in Belgian local time
  const formatTimeHM = (isoStr?: string | null) => {
    return formatBelgianTimeHM(isoStr);
  };

  // Format full date in Dutch in Belgian local time
  const fullDateString = useMemo(() => {
    return formatBelgianFullDate(currentTime);
  }, [currentTime]);

  // Greeting based on Belgian hour
  const greetingText = useMemo(() => {
    const hour = getBelgianHour(currentTime);
    if (hour < 12) return 'Goedemorgen';
    if (hour < 18) return 'Goedemiddag';
    return 'Goedenavond';
  }, [currentTime]);

  // History grouped by date
  const staffHistory = useMemo(() => {
    if (!selectedStaffId) return [];
    return timesheets
      .filter(ts => ts.staffId === selectedStaffId)
      .sort((a, b) => b.clockIn.localeCompare(a.clockIn));
  }, [timesheets, selectedStaffId]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans select-none antialiased">
      
      {/* OFFLINE / LIVE BANNER */}
      {!isOnline && (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-center gap-2 shadow-sm animate-pulse">
          <WifiOff className="h-4 w-4" />
          <span>Offline modus: Tiktijden worden lokaal bewaard en gesynchroniseerd zodra verbinding herstelt.</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white flex items-center gap-1.5">
              <span>HCG Tiktijden</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isProd ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'}`}>
                {isProd ? 'Live GitHub' : 'Test Preview'}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></span>
              Live gesynchroniseerd
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Share / QR Code Button */}
          <button
            onClick={() => {
              playMobileSound('tap');
              setIsShareModalOpen(true);
            }}
            title="Deel link of toon QR code"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700/60"
          >
            <QrCode className="h-4 w-4" />
          </button>

          {/* Install on Smartphone Button */}
          <button
            onClick={() => {
              playMobileSound('tap');
              handleTriggerInstall();
            }}
            title="Installeer op smartphone"
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-indigo-400 hover:text-indigo-300 transition cursor-pointer border border-slate-700/60"
          >
            <Smartphone className="h-4 w-4" />
          </button>

          {/* Switch View / Admin Link */}
          {onSwitchView && (
            <button
              onClick={() => {
                playMobileSound('tap');
                if (systemConfig.kioskLocked && onOpenAdminWithPin) {
                  onOpenAdminWithPin();
                } else if (onOpenAdmin) {
                  onOpenAdmin();
                } else {
                  onSwitchView('admin');
                }
              }}
              className="text-[11px] font-bold px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700/60 cursor-pointer"
            >
              Balie PC
            </button>
          )}
        </div>
      </header>

      {/* TOAST MESSAGE */}
      {toastMessage && (
        <div className="fixed top-16 left-4 right-4 z-50 flex justify-center animate-in fade-in slide-in-from-top-4 duration-200">
          <div className={`px-4 py-3 rounded-2xl shadow-xl text-xs sm:text-sm font-semibold max-w-md w-full flex items-center justify-between gap-3 border ${
            toastMessage.type === 'success' 
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-950/40' 
              : toastMessage.type === 'error'
              ? 'bg-rose-600 text-white border-rose-500 shadow-rose-950/40'
              : 'bg-indigo-600 text-white border-indigo-500 shadow-indigo-950/40'
          }`}>
            <span className="flex-1">{toastMessage.text}</span>
            <button onClick={() => setToastMessage(null)} className="p-1 hover:bg-black/20 rounded-full">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* MAIN MOBILE CONTENT CONTAINER (Optimized for one-handed mobile use) */}
      <main className="flex-1 max-w-md w-full mx-auto px-4 py-4 pb-24 flex flex-col justify-start">
        
        {/* CURRENT STAFF CARD & SWITCHER */}
        <div className="bg-slate-800/80 rounded-2xl p-3.5 border border-slate-700/80 mb-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-base shadow-sm">
              {currentStaff ? currentStaff.name.charAt(0) : '?'}
            </div>
            <div>
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Aangemelde medewerker
              </p>
              <h2 className="text-base font-bold text-white tracking-tight">
                {currentStaff ? currentStaff.name : 'Selecteer medewerker'}
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              playMobileSound('tap');
              setIsSwitchStaffOpen(true);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-xs font-bold text-indigo-300 hover:text-white transition border border-slate-600/60 cursor-pointer"
          >
            Wissel
          </button>
        </div>


        {/* TAB 1: DE SNELLE 1-KLIK TIKKLOK */}
        {mobileTab === 'clock' && (
          <div className="space-y-4">
            
            {/* DIGITAL CLOCK CARD */}
            <div className="bg-slate-800/50 rounded-3xl p-5 border border-slate-700/60 text-center relative overflow-hidden shadow-inner">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-1">
                {fullDateString}
              </div>
              <div className="font-mono text-4xl sm:text-5xl font-black tracking-tight text-white drop-shadow-sm">
                {formatBelgianTimeHMS(currentTime)}
              </div>
              <div className="mt-2 text-xs font-medium text-slate-400">
                {greetingText}, <span className="font-bold text-slate-200">{currentStaff?.name || 'collega'}</span>
              </div>
            </div>

            {/* STATUS & BIG ACTION BUTTON */}
            <div className={`rounded-3xl p-6 border transition-all duration-300 shadow-xl ${
              isClockedIn 
                ? 'bg-gradient-to-b from-emerald-950/80 to-slate-900 border-emerald-500/40 shadow-emerald-950/30' 
                : 'bg-gradient-to-b from-slate-800/90 to-slate-900 border-slate-700 shadow-slate-950/40'
            }`}>
              
              {/* CURRENT SHIFT STATUS */}
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-700/60">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${isClockedIn ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                  <span className="text-xs uppercase font-extrabold tracking-wider text-slate-300">
                    {isClockedIn ? 'Momenteel ingeklokt' : 'Momenteel uitgeklokt'}
                  </span>
                </div>
                {isClockedIn && (
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Sinds {formatTimeHM(activeOpenTimesheet?.clockIn)} ({currentShiftDurationStr})
                  </span>
                )}
              </div>

              {/* GIANT ACTION BUTTON (1 TAP) */}
              {isClockedIn ? (
                <button
                  onClick={handleClockOut}
                  className="w-full py-6 px-4 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 active:scale-[0.98] text-white font-extrabold text-lg sm:text-xl shadow-lg shadow-rose-900/40 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer border border-rose-400/40"
                >
                  <div className="flex items-center gap-2">
                    <LogOut className="h-6 w-6" />
                    <span>NU UIT TIKKEN</span>
                  </div>
                  <span className="text-xs font-normal text-rose-100 opacity-90">
                    Shift afronden voor {currentStaff?.name}
                  </span>
                </button>
              ) : (
                <button
                  onClick={handleClockIn}
                  className="w-full py-6 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 active:scale-[0.98] text-white font-extrabold text-lg sm:text-xl shadow-lg shadow-emerald-950/50 transition flex flex-col items-center justify-center gap-1.5 cursor-pointer border border-emerald-400/40"
                >
                  <div className="flex items-center gap-2">
                    <LogIn className="h-6 w-6" />
                    <span>NU IN TIKKEN</span>
                  </div>
                  <span className="text-xs font-normal text-emerald-100 opacity-90">
                    Werkdag of pauze starten voor {currentStaff?.name}
                  </span>
                </button>
              )}

            </div>

            {/* TODAY'S SESSIONS LIST */}
            <div className="bg-slate-800/40 rounded-2xl p-4 border border-slate-700/60 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                  <span>Vandaag geregistreerd ({todayTimesheets.length})</span>
                </h3>

                <button
                  onClick={() => {
                    playMobileSound('tap');
                    setManualDate(todayStr);
                    setIsManualModalOpen(true);
                  }}
                  className="text-[11px] font-bold text-indigo-400 hover:text-indigo-300 transition flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  Vergeten te tikken?
                </button>
              </div>

              {todayTimesheets.length === 0 ? (
                <div className="text-center py-6 text-slate-500 text-xs font-medium">
                  Nog geen tiktijden geregistreerd voor vandaag.
                </div>
              ) : (
                <div className="space-y-2">
                  {todayTimesheets.map(ts => {
                    const inHM = formatTimeHM(ts.clockIn);
                    const outHM = ts.clockOut ? formatTimeHM(ts.clockOut) : 'Bezig...';
                    return (
                      <div
                        key={ts.id}
                        className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${ts.clockOut ? 'bg-indigo-400' : 'bg-emerald-400 animate-pulse'}`} />
                          <span className="font-mono font-bold text-slate-200">{inHM}</span>
                          <span className="text-slate-500">→</span>
                          <span className="font-mono font-bold text-slate-200">{outHM}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-semibold text-slate-400">
                            {ts.clockOut ? 'Voltooid' : 'Actief'}
                          </span>
                          {onDeleteTimesheet && (
                            <button
                              onClick={() => {
                                if (confirm(`Tiktijd (${inHM} - ${outHM}) verwijderen?`)) {
                                  onDeleteTimesheet(ts.id);
                                  showToast("Tiktijd verwijderd.", "success");
                                }
                              }}
                              className="p-1 text-slate-500 hover:text-red-400 rounded transition cursor-pointer"
                              title="Tiktijd verwijderen"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SMARTPHONE APP PROMO / SHORTCUT BANNER */}
            <div className="bg-gradient-to-r from-indigo-950/60 to-purple-950/60 rounded-2xl p-3.5 border border-indigo-700/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-indigo-600/40 flex items-center justify-center text-indigo-300 shrink-0">
                  <Smartphone className="h-4 w-4" />
                </div>
                <div className="text-xs">
                  <p className="font-bold text-slate-200">Tip: Zet op je beginscherm</p>
                  <p className="text-[11px] text-slate-400">Open voortaan in 1 tik als een mobiele app</p>
                </div>
              </div>
              <button
                onClick={() => setIsInstallModalOpen(true)}
                className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer shrink-0"
              >
                Uitleg
              </button>
            </div>

          </div>
        )}

        {/* TAB 2: MIJN UREN HISTORIEK */}
        {mobileTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">Historiek van {currentStaff?.name}</h3>
                <p className="text-xs text-slate-400">Al uw geregistreerde in- en uittijden</p>
              </div>

              <button
                onClick={() => {
                  playMobileSound('tap');
                  setManualDate(todayStr);
                  setIsManualModalOpen(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                Tijd Toevoegen
              </button>
            </div>

            {staffHistory.length === 0 ? (
              <div className="text-center py-12 bg-slate-800/40 rounded-2xl border border-slate-700/60 text-slate-400 text-xs font-medium">
                Nog geen historische tiktijden gevonden voor deze medewerker.
              </div>
            ) : (
              <div className="space-y-2.5">
                {staffHistory.slice(0, 30).map(ts => {
                  const dateObj = new Date(ts.clockIn);
                  const dateDisplay = formatBelgianShortDate(ts.clockIn);
                  const inHM = formatTimeHM(ts.clockIn);
                  const outHM = ts.clockOut ? formatTimeHM(ts.clockOut) : 'Actief';

                  // Calculate duration
                  let durStr = '--';
                  if (ts.clockOut) {
                    const diffMins = Math.max(0, Math.floor((new Date(ts.clockOut).getTime() - dateObj.getTime()) / (1000 * 60)));
                    const h = Math.floor(diffMins / 60);
                    const m = diffMins % 60;
                    durStr = `${h}u ${m < 10 ? '0' : ''}${m}m`;
                  }

                  return (
                    <div
                      key={ts.id}
                      className="p-3 bg-slate-800/70 rounded-xl border border-slate-700/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-200 capitalize">{dateDisplay}</div>
                        <div className="text-slate-400 font-mono text-[11px] mt-0.5">
                          {inHM} - {outHM}
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="font-mono font-bold text-indigo-300">{durStr}</div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            ts.clockOut ? 'bg-slate-700 text-slate-300' : 'bg-emerald-500/20 text-emerald-300'
                          }`}>
                            {ts.clockOut ? 'Voltooid' : 'Nog ingeklokt'}
                          </span>
                        </div>
                        {onDeleteTimesheet && (
                          <button
                            onClick={() => {
                              if (confirm(`Tiktijd van ${dateDisplay} (${inHM}) definitief verwijderen?`)) {
                                onDeleteTimesheet(ts.id);
                                showToast("Tiktijd verwijderd.", "success");
                              }
                            }}
                            className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-700/60 transition cursor-pointer"
                            title="Tiktijd verwijderen"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: WIE IS ER NU? (TEAM OVERZICHT) */}
        {mobileTab === 'team' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-sm text-white">Live Team Status</h3>
              <p className="text-xs text-slate-400">Wie is er momenteel aan het werk op de praktijk?</p>
            </div>

            <div className="space-y-2">
              {activeStaffList.map(st => {
                const openTs = timesheets.find(
                  ts => ts.staffId === st.id && ts.date === todayStr && !ts.clockOut
                );
                const isWorking = !!openTs;

                return (
                  <div
                    key={st.id}
                    className={`p-3 rounded-xl border flex items-center justify-between transition ${
                      isWorking 
                        ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-100' 
                        : 'bg-slate-800/40 border-slate-700/60 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isWorking ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-300'
                      }`}>
                        {st.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-xs text-white flex items-center gap-1.5">
                          <span>{st.name}</span>
                          {st.id === selectedStaffId && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-indigo-500/30 text-indigo-300 rounded font-semibold">
                              Jij
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {isWorking ? `Aan het werk sinds ${formatTimeHM(openTs.clockIn)}` : 'Niet ingeklokt'}
                        </div>
                      </div>
                    </div>

                    <div>
                      {isWorking ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Aanwezig
                        </span>
                      ) : (
                        <span className="text-[11px] font-medium text-slate-500">
                          Afwezig
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </main>

      {/* MODAL 1: WISSEL MEDEWERKER */}
      {isSwitchStaffOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-800 border border-slate-700 rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">Wie ben jij?</h3>
                <p className="text-xs text-slate-400">Selecteer je naam om snel in/uit te tikken</p>
              </div>
              <button
                onClick={() => setIsSwitchStaffOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {activeStaffList.map(staff => {
                const isSelected = staff.id === selectedStaffId;
                return (
                  <button
                    key={staff.id}
                    onClick={() => {
                      playMobileSound('tap');
                      setSelectedStaffId(staff.id);
                      setIsSwitchStaffOpen(false);
                      showToast(`Ingesteld op ${staff.name}`, 'info');
                    }}
                    className={`w-full p-3 rounded-xl border flex items-center justify-between text-left transition cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/30 border-indigo-500 text-white'
                        : 'bg-slate-700/50 hover:bg-slate-700 border-slate-600 text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-600 text-slate-300'
                      }`}>
                        {staff.name.charAt(0)}
                      </div>
                      <span className="font-bold text-xs">{staff.name}</span>
                    </div>
                    {isSelected && <Check className="h-4 w-4 text-indigo-400" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: MANUELE TIKTIJD TOEVOEGEN */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-800 border border-slate-700 rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <div>
                <h3 className="font-bold text-base text-white">Vergeten te tikken?</h3>
                <p className="text-xs text-slate-400">Voeg een tiktijd toe voor {currentStaff?.name}</p>
              </div>
              <button
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveManualTime} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300 uppercase">Datum</label>
                <input
                  type="date"
                  value={manualDate}
                  onChange={e => setManualDate(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase">Ingetikt om *</label>
                  <input
                    type="time"
                    value={manualIn}
                    onChange={e => setManualIn(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-300 uppercase">Uitgetikt om</label>
                  <input
                    type="time"
                    value={manualOut}
                    onChange={e => setManualOut(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-medium"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold transition cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition cursor-pointer shadow-md"
                >
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DEEL LINK & QR CODE VOOR SMARTPHONE */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-800 border border-slate-700 rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-6 shadow-2xl text-center space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="font-bold text-base text-white text-left">Scan op Smartphone</h3>
              <button
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 text-left">
              Scan deze QR-code met de camera van uw smartphone om direct de mobiele tiktijden app te openen:
            </p>

            {/* QR CODE CONTAINER */}
            <div className="bg-white p-3 rounded-2xl inline-block shadow-md border border-slate-300">
              {qrCodeDataUrl ? (
                <img src={qrCodeDataUrl} alt="Smartphone QR Code" className="w-56 h-56 mx-auto rounded-lg" />
              ) : (
                <div className="w-56 h-56 flex items-center justify-center text-slate-400">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              )}
            </div>

            {/* DIRECT URL & COPY BUTTON */}
            <div className="space-y-2">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-mono text-slate-300 break-all select-all text-left">
                {mobileAppUrl}
              </div>

              <button
                onClick={handleCopyLink}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                {copiedLink ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{copiedLink ? 'Link Gekopieerd!' : 'Kopieer Directe Link'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: INSTALLATIE OP BEGINSCHERM HANDLEIDING */}
      {isInstallModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-slate-800 border border-slate-700 rounded-t-3xl sm:rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-700 pb-3">
              <h3 className="font-bold text-base text-white">Zet op je Smartphone Beginscherm</h3>
              <button
                onClick={() => setIsInstallModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300">
              <div className="p-3 rounded-xl bg-slate-700/40 border border-slate-600/60 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>🍎 Op iPhone (Safari):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                  <li>Tik onderaan op het <strong>Deel-icoon</strong> (vierkantje met pijl omhoog).</li>
                  <li>Scroll omlaag en tik op <strong>“Zet op beginscherm”</strong> (+).</li>
                  <li>Tik rechtsboven op <strong>“Voeg toe”</strong>.</li>
                </ol>
              </div>

              <div className="p-3 rounded-xl bg-slate-700/40 border border-slate-600/60 space-y-1.5">
                <div className="font-bold text-white flex items-center gap-1.5">
                  <span>🤖 Op Android (Chrome):</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px]">
                  <li>Tik rechtsboven op het menu (<strong>3 puntjes ⋮</strong>).</li>
                  <li>Tik op <strong>“Toevoegen aan startscherm”</strong> of <strong>“App installeren”</strong>.</li>
                  <li>Bevestig met <strong>“Toevoegen”</strong>.</li>
                </ol>
              </div>

              <p className="text-[11px] text-slate-400 italic">
                Hierna staat het icoon <strong>“HCG Tiktijden”</strong> rechtstreeks tussen je apps op je smartphone en kun je elke dag in 1 tik in- en uitklokken!
              </p>
            </div>

            <button
              onClick={() => setIsInstallModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs transition cursor-pointer"
            >
              Begrepen
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
