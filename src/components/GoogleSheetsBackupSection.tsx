/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { Timesheet, ActiveStaff, SystemConfig } from '../types';
import {
  initGoogleAuth,
  googleSignIn,
  googleLogout,
  getAccessToken,
  backupTimesheetsToGoogleSheets
} from '../services/googleSheetsService';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Check,
  RotateCcw
} from 'lucide-react';
import { BackupRestoreModal } from './BackupRestoreModal';

interface GoogleSheetsBackupSectionProps {
  timesheets: Timesheet[];
  staffList: ActiveStaff[];
  systemConfig: SystemConfig;
  onUpdateConfig: (config: Partial<SystemConfig>) => void;
  onRestoreTimesheets?: (restored: Timesheet[]) => Promise<void>;
}

export default function GoogleSheetsBackupSection({
  timesheets,
  staffList,
  systemConfig,
  onUpdateConfig,
  onRestoreTimesheets
}: GoogleSheetsBackupSectionProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [hasToken, setHasToken] = useState<boolean>(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Listen to auth state
  useEffect(() => {
    const unsubscribe = initGoogleAuth(
      (user, token) => {
        setCurrentUser(user);
        setHasToken(!!token);
      },
      () => {
        setCurrentUser(null);
        setHasToken(false);
      }
    );
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setSyncFeedback(null);
    try {
      const res = await googleSignIn();
      if (!res) {
        // Gebruiker heeft inloggen geannuleerd of pop-up venster gesloten
        return;
      }
      setCurrentUser(res.user);
      setHasToken(true);
      setSyncFeedback({
        type: 'success',
        message: `Verbonden met Google Account: ${res.user.email}`
      });
    } catch (err: any) {
      const isCancelled =
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user') ||
        err?.message?.includes('cancelled-popup-request');

      if (isCancelled) {
        return;
      }

      console.error('Google Sign In failed:', err);
      let errorMsg = err.message || 'Inloggen met Google is mislukt.';
      if (err?.code === 'auth/popup-blocked') {
        errorMsg = 'De Google inlog pop-up werd geblokkeerd door uw browser. Sta pop-ups toe in de browserbalk.';
      }
      setSyncFeedback({
        type: 'error',
        message: errorMsg
      });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await googleLogout();
      setCurrentUser(null);
      setHasToken(false);
      setSyncFeedback(null);
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  // Trigger manual sync after confirmation
  const handleExecuteSync = async () => {
    setShowConfirmModal(false);
    const token = getAccessToken();
    if (!token) {
      setSyncFeedback({
        type: 'error',
        message: 'Gelieve eerst in te loggen met uw Google Account om toegang te verlenen.'
      });
      return;
    }

    setIsSyncing(true);
    setSyncFeedback(null);

    try {
      const result = await backupTimesheetsToGoogleSheets(
        token,
        timesheets,
        staffList,
        systemConfig.googleSheetsSpreadsheetId
      );

      onUpdateConfig({
        googleSheetsSpreadsheetId: result.spreadsheetId,
        googleSheetsSpreadsheetUrl: result.spreadsheetUrl,
        lastGoogleSheetsBackupAt: result.timestamp,
        lastGoogleSheetsBackupStatus: 'Success',
        lastGoogleSheetsBackupCount: result.count,
        lastGoogleSheetsBackupMessage: `${result.count} tiktijden bewaard in Google Sheets.`
      });

      setSyncFeedback({
        type: 'success',
        message: `Succesvol gebackupt! ${result.count} tiktijden opgeslagen in uw Google Sheets document.`
      });
    } catch (err: any) {
      console.error('Sync failed:', err);
      onUpdateConfig({
        lastGoogleSheetsBackupStatus: 'Failed',
        lastGoogleSheetsBackupMessage: err.message || 'Onbekende fout tijdens synchronisatie.'
      });
      setSyncFeedback({
        type: 'error',
        message: `Fout tijdens backup naar Google Sheets: ${err.message || 'Onbekende fout'}`
      });
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div id="google-sheets-backup-card" className="bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/50 rounded-2xl border border-emerald-200/80 p-5 shadow-sm space-y-4">
      {/* Header - all controls in one line */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2 flex-wrap">
              Google Sheets Tiktijden Backup
              <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full border border-emerald-200">
                Elke avond om 22:00
              </span>
            </h4>
          </div>
        </div>

        {/* Header Action Controls & Google Account Connection on 1 line */}
        <div className="flex items-center gap-2 flex-wrap md:flex-nowrap shrink-0">
          <button
            id="btn-google-sheets-manual-sync"
            onClick={() => {
              if (!hasToken) {
                handleLogin();
              } else {
                setShowConfirmModal(true);
              }
            }}
            disabled={isSyncing}
            className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm text-xs shrink-0 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Bezig...' : 'Nu Synchroniseren'}</span>
          </button>

          <button
            id="btn-restore-timesheets-backup"
            type="button"
            onClick={() => setShowRestoreModal(true)}
            className="py-1.5 px-3 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm text-xs shrink-0 whitespace-nowrap"
            title="Herstel of schakel over naar een eerdere backup van tiktijden (PIN bevestiging vereist)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Overstappen naar Backup</span>
          </button>

          {systemConfig.googleSheetsSpreadsheetUrl && (
            <a
              id="link-open-google-sheet"
              href={systemConfig.googleSheetsSpreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="py-1.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer text-xs shrink-0 whitespace-nowrap"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>Open Sheet ↗</span>
            </a>
          )}

          {currentUser && hasToken ? (
            <div className="flex items-center gap-2 bg-emerald-100/80 text-emerald-900 px-3 py-1 rounded-xl border border-emerald-300 text-xs shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700 shrink-0" />
              <div className="truncate max-w-[150px]">
                <span className="font-bold block truncate leading-tight">{currentUser.displayName || 'Google Verbonden'}</span>
                <span className="text-[10px] text-emerald-700 truncate block leading-tight">{currentUser.email}</span>
              </div>
              <button
                id="btn-google-sheets-disconnect"
                onClick={handleLogout}
                className="ml-1 text-emerald-700 hover:text-red-600 transition p-0.5 hover:bg-emerald-200 rounded cursor-pointer"
                title="Account ontkoppelen"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              id="btn-google-sheets-signin"
              onClick={handleLogin}
              disabled={isLoggingIn}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl font-bold text-xs shadow-sm transition hover:shadow cursor-pointer disabled:opacity-50 shrink-0 whitespace-nowrap"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isLoggingIn ? 'Verbinden...' : 'Inloggen met Google'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback Messages */}
      {syncFeedback && (
        <div
          className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
            syncFeedback.type === 'success'
              ? 'bg-emerald-100/90 text-emerald-900 border border-emerald-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {syncFeedback.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
          )}
          <span>{syncFeedback.message}</span>
        </div>
      )}

      {/* Confirmation Modal (Mandatory for mutating Workspace APIs) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-md w-full shadow-xl border border-slate-200 space-y-4 animate-scale-up">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <FileSpreadsheet className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-sm">Synchroniseer naar Google Sheets</h3>
                <p className="text-xs text-slate-500">Personeel tiktijden bijwerken</p>
              </div>
            </div>

            <div className="text-xs text-slate-600 space-y-2">
              <p>
                U staat op het punt om <span className="font-bold text-slate-800">{timesheets.length} tiktijden</span> te exporteren en synchroniseren naar het Google Sheets document:
              </p>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-700">
                Document: DermatoMed - Personeel Tiktijden Historiek & Backup
              </div>
              <p className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded border border-emerald-200">
                ✓ Alle eerdere historische records in de sheet blijven bewaard en worden chronologisch samengevoegd.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                id="btn-confirm-sync-cancel"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-xl text-xs border border-slate-200 transition cursor-pointer"
              >
                Annuleren
              </button>
              <button
                id="btn-confirm-sync-proceed"
                onClick={handleExecuteSync}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition shadow cursor-pointer flex items-center gap-1.5"
              >
                <Check className="h-3.5 w-3.5" />
                Bevestigen en Synchroniseren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore / Overstappen naar Backup Modal */}
      <BackupRestoreModal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        mode="timesheets"
        systemConfig={systemConfig}
        staffList={staffList}
        onRestoreTimesheets={onRestoreTimesheets}
        onSuccessMessage={(msg) => {
          setSyncFeedback({
            type: 'success',
            message: msg
          });
        }}
      />
    </div>
  );
}
