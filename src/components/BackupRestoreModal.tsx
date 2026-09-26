import React, { useState, useEffect } from 'react';
import { 
  RotateCcw, 
  FileSpreadsheet, 
  UploadCloud, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Eye, 
  EyeOff, 
  X, 
  Loader2, 
  Calendar, 
  Clock, 
  UserCheck,
  FileText
} from 'lucide-react';
import { 
  SystemConfig, 
  Timesheet, 
  ActiveStaff, 
  StaffMember, 
  LeaveRequest, 
  LeaveSlot, 
  LeaveType, 
  LeaveStatus 
} from '../types';
import { 
  getAccessToken, 
  getStoredGoogleUser, 
  restoreTimesheetsFromGoogleSheets, 
  extractSpreadsheetId 
} from '../services/googleSheetsService';
import { restoreLeaveRequestsFromGoogleSheets } from '../services/leaveSheetsBackup';
import { formatBelgianDate } from '../services/leaveService';

export interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'timesheets' | 'leave';
  systemConfig: SystemConfig;
  staffList?: ActiveStaff[];
  leaveStaffList?: StaffMember[];
  onRestoreTimesheets?: (restored: Timesheet[]) => Promise<void>;
  onRestoreLeaveRequests?: (restored: LeaveRequest[]) => Promise<void>;
  onSuccessMessage?: (msg: string) => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({
  isOpen,
  onClose,
  mode,
  systemConfig,
  staffList = [],
  leaveStaffList = [],
  onRestoreTimesheets,
  onRestoreLeaveRequests,
  onSuccessMessage
}) => {
  const [sourceType, setSourceType] = useState<'sheets' | 'file'>('sheets');
  const [spreadsheetInput, setSpreadsheetInput] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  
  // Inspection & preview state
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [previewTimesheets, setPreviewTimesheets] = useState<Timesheet[] | null>(null);
  const [previewLeaveRequests, setPreviewLeaveRequests] = useState<LeaveRequest[] | null>(null);

  // PIN validation state
  const [pinInput, setPinInput] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Active Google User
  const googleUser = getStoredGoogleUser();

  // Prepopulate spreadsheet input based on mode
  useEffect(() => {
    if (isOpen) {
      setPinInput('');
      setPinError(null);
      setInspectError(null);
      setSuccessNotice(null);
      setPreviewTimesheets(null);
      setPreviewLeaveRequests(null);
      setUploadedFile(null);

      if (mode === 'timesheets') {
        setSpreadsheetInput(systemConfig.googleSheetsSpreadsheetId || '');
      } else {
        setSpreadsheetInput(
          systemConfig.leaveGoogleSheetsSpreadsheetId || 
          systemConfig.googleSheetsSpreadsheetId || 
          ''
        );
      }
    }
  }, [isOpen, mode, systemConfig]);

  if (!isOpen) return null;

  const currentAdminPin = systemConfig.adminPin || '1234';

  const handleInspect = async () => {
    setInspectError(null);
    setPinError(null);
    setPreviewTimesheets(null);
    setPreviewLeaveRequests(null);
    setIsInspecting(true);

    try {
      if (sourceType === 'sheets') {
        const token = getAccessToken();
        if (!token) {
          throw new Error('Nog niet aangemeld met Google. Meld eerst aan bij het Tiktijden Google Sheets beheer.');
        }

        const id = extractSpreadsheetId(spreadsheetInput.trim());
        if (!id) {
          throw new Error('Voer een geldig Google Spreadsheet ID of URL in.');
        }

        if (mode === 'timesheets') {
          const res = await restoreTimesheetsFromGoogleSheets(token, id, staffList);
          setPreviewTimesheets(res.restoredTimesheets);
        } else {
          const res = await restoreLeaveRequestsFromGoogleSheets(token, id, leaveStaffList);
          setPreviewLeaveRequests(res.restoredRequests);
        }
      } else {
        // File source (CSV or JSON)
        if (!uploadedFile) {
          throw new Error('Selecteer eerst een bestand om in te lezen.');
        }
        const text = await uploadedFile.text();
        
        if (uploadedFile.name.endsWith('.json')) {
          const parsed = JSON.parse(text);
          if (!Array.isArray(parsed)) {
            throw new Error('Het JSON bestand moet een array van records bevatten.');
          }
          if (mode === 'timesheets') {
            setPreviewTimesheets(parsed as Timesheet[]);
          } else {
            setPreviewLeaveRequests(parsed as LeaveRequest[]);
          }
        } else {
          // Parse CSV
          const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          if (lines.length <= 1) {
            throw new Error('Het CSV bestand bevat geen gegevensrijen.');
          }

          if (mode === 'timesheets') {
            const list: Timesheet[] = [];
            // Assuming CSV format: ID, Datum, Medewerker, Inklokken, Uitklokken
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(';').length > 1 ? lines[i].split(';') : lines[i].split(',');
              const clean = cols.map(c => c.replace(/^["']|["']$/g, '').trim());
              if (clean.length >= 3) {
                const date = clean[1];
                const staffName = clean[2];
                const matched = staffList.find(s => s.name.toLowerCase() === staffName.toLowerCase());
                list.push({
                  id: clean[0] || `ts-restored-${i}`,
                  date,
                  staffName,
                  staffId: matched ? matched.id : `staff-${i}`,
                  clockIn: clean[3] || `${date}T08:00:00`,
                  clockOut: clean[4] && clean[4] !== '-' ? clean[4] : null
                });
              }
            }
            if (list.length === 0) throw new Error('Geen geldige rijen gevonden in het bestand.');
            setPreviewTimesheets(list);
          } else {
            const list: LeaveRequest[] = [];
            for (let i = 1; i < lines.length; i++) {
              const cols = lines[i].split(';').length > 1 ? lines[i].split(';') : lines[i].split(',');
              const clean = cols.map(c => c.replace(/^["']|["']$/g, '').trim());
              if (clean.length >= 4) {
                const date = clean[0];
                const staffName = clean[3] || clean[1];
                const slotStr = (clean[5] || '').toUpperCase();
                const slot: LeaveSlot = slotStr.includes('VM') ? 'VM' : (slotStr.includes('NM') ? 'NM' : 'HELE_DAG');
                const matched = leaveStaffList.find(s => s.name.toLowerCase() === staffName.toLowerCase());
                list.push({
                  id: clean[11] || `req-restored-${i}`,
                  date,
                  staff_id: matched ? matched.id : `staff-${i}`,
                  staff_name: staffName,
                  slot,
                  units: slot === 'HELE_DAG' ? 1.0 : 0.5,
                  type: (clean[7] || '').toLowerCase().includes('verplicht') ? 'verplicht' : 'regulier',
                  status: (clean[8] || '').toLowerCase().includes('goedgekeurd') ? 'goedgekeurd' : 'aangevraagd',
                  note: clean[9] || 'Hersteld uit backup',
                  created_at: new Date().toISOString()
                });
              }
            }
            if (list.length === 0) throw new Error('Geen geldige verlofrijen gevonden in het bestand.');
            setPreviewLeaveRequests(list);
          }
        }
      }
    } catch (err: any) {
      console.error('Inspect error:', err);
      setInspectError(err?.message || 'Er is een fout opgetreden bij het inspecteren van de backup.');
    } finally {
      setIsInspecting(false);
    }
  };

  const handleConfirmRestore = async () => {
    setPinError(null);

    // 1. PIN Check
    if (pinInput.trim() !== currentAdminPin) {
      setPinError('Onjuiste PIN-code. Voer de geldige 4-cijferige beheerder-PIN in.');
      return;
    }

    // 2. Data check
    const itemsCount = mode === 'timesheets' 
      ? (previewTimesheets?.length || 0) 
      : (previewLeaveRequests?.length || 0);

    if (itemsCount === 0) {
      setPinError('Inspecteer eerst de backup en controleer dat er geldige records zijn gevonden.');
      return;
    }

    setIsExecuting(true);
    try {
      if (mode === 'timesheets' && previewTimesheets && onRestoreTimesheets) {
        await onRestoreTimesheets(previewTimesheets);
        const msg = `✓ Succesvol overgestapt naar backup! ${previewTimesheets.length} tiktijden zijn hersteld in het systeem.`;
        setSuccessNotice(msg);
        if (onSuccessMessage) onSuccessMessage(msg);
      } else if (mode === 'leave' && previewLeaveRequests && onRestoreLeaveRequests) {
        await onRestoreLeaveRequests(previewLeaveRequests);
        const msg = `✓ Succesvol overgestapt naar backup! ${previewLeaveRequests.length} verlofaanvragen zijn hersteld in het systeem.`;
        setSuccessNotice(msg);
        if (onSuccessMessage) onSuccessMessage(msg);
      }

      setTimeout(() => {
        onClose();
      }, 1800);
    } catch (err: any) {
      console.error('Restore execution error:', err);
      setPinError(`Herstel mislukt: ${err?.message || 'Onbekende fout bij database opslag'}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const previewCount = mode === 'timesheets' 
    ? (previewTimesheets?.length || 0) 
    : (previewLeaveRequests?.length || 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <RotateCcw className="h-6 w-6 text-amber-200" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                {mode === 'timesheets' ? 'Overstappen naar Tiktijden Backup' : 'Overstappen naar Verlofplanning Backup'}
              </h2>
              <p className="text-xs text-amber-100 font-medium">
                Herstel het actieve systeem vanuit een Google Sheets backup of bestand
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isExecuting}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Success Banner */}
          {successNotice && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center space-x-3 text-emerald-800">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div className="font-bold text-sm">{successNotice}</div>
            </div>
          )}

          {/* Source Selector Tabs */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              1. Kies Backup Bron
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => { setSourceType('sheets'); setPreviewTimesheets(null); setPreviewLeaveRequests(null); }}
                className={`flex items-center justify-center space-x-2.5 p-3 rounded-xl border-2 transition-all font-semibold text-sm ${
                  sourceType === 'sheets'
                    ? 'border-amber-600 bg-amber-50/50 text-amber-900 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                }`}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Google Sheets Document</span>
              </button>

              <button
                type="button"
                onClick={() => { setSourceType('file'); setPreviewTimesheets(null); setPreviewLeaveRequests(null); }}
                className={`flex items-center justify-center space-x-2.5 p-3 rounded-xl border-2 transition-all font-semibold text-sm ${
                  sourceType === 'file'
                    ? 'border-amber-600 bg-amber-50/50 text-amber-900 shadow-sm'
                    : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                }`}
              >
                <UploadCloud className="h-4 w-4 text-blue-600" />
                <span>Bestand Uploaden (CSV / JSON)</span>
              </button>
            </div>
          </div>

          {/* Source Specific Inputs */}
          {sourceType === 'sheets' ? (
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span className="font-bold flex items-center space-x-1">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Google Account (via Tiktijden):</span>
                </span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-semibold text-slate-700">
                  {googleUser?.email || 'Aangemeld bij Tiktijden'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Google Spreadsheet ID of Volledige URL:
                </label>
                <input
                  type="text"
                  value={spreadsheetInput}
                  onChange={(e) => setSpreadsheetInput(e.target.value)}
                  placeholder="bv. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                  className="w-full text-xs font-mono px-3 py-2.5 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Leest het tabblad {mode === 'timesheets' ? '“Historiek Tiktijden”' : '“Geplande & Aangevraagde Verloven”'}.
                </span>
                <button
                  type="button"
                  onClick={handleInspect}
                  disabled={isInspecting || !spreadsheetInput.trim()}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow flex items-center space-x-2 transition-all"
                >
                  {isInspecting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Controleren...</span>
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="h-3.5 w-3.5" />
                      <span>Backup Inspecteren</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Selecteer geëxporteerd backup bestand:
              </label>
              <input
                type="file"
                accept=".csv, .json"
                onChange={(e) => setUploadedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700 file:cursor-pointer"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">
                  Ondersteunt .csv (met puntkomma of komma) en .json bestanden.
                </span>
                <button
                  type="button"
                  onClick={handleInspect}
                  disabled={isInspecting || !uploadedFile}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white text-xs font-bold rounded-lg shadow flex items-center space-x-2 transition-all"
                >
                  {isInspecting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Bestand Inlezen...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-3.5 w-3.5" />
                      <span>Bestand Inspecteren</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Inspect Error */}
          {inspectError && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-700 text-xs font-semibold flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{inspectError}</span>
            </div>
          )}

          {/* Preview Section */}
          {previewCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>2. Backup Inhoud Gevalideerd</span>
                </span>
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full">
                  {previewCount} {mode === 'timesheets' ? 'tiktijden' : 'verlofaanvragen'} gereed
                </span>
              </div>

              {/* Mini preview table */}
              <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 bg-white text-xs">
                {mode === 'timesheets' && previewTimesheets && (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                      <tr>
                        <th className="p-2">Datum</th>
                        <th className="p-2">Medewerker</th>
                        <th className="p-2">Inklokken</th>
                        <th className="p-2">Uitklokken</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {previewTimesheets.slice(0, 5).map((ts, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-mono text-slate-700">{formatBelgianDate(ts.date)}</td>
                          <td className="p-2 text-slate-900">{ts.staffName}</td>
                          <td className="p-2 font-mono text-slate-600">
                            {ts.clockIn ? ts.clockIn.substring(11, 16) || ts.clockIn : '-'}
                          </td>
                          <td className="p-2 font-mono text-slate-600">
                            {ts.clockOut ? ts.clockOut.substring(11, 16) || ts.clockOut : 'Nog ingeklokt'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {mode === 'leave' && previewLeaveRequests && (
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                      <tr>
                        <th className="p-2">Datum</th>
                        <th className="p-2">Personeel</th>
                        <th className="p-2">Dagdeel</th>
                        <th className="p-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {previewLeaveRequests.slice(0, 5).map((req, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-mono text-slate-700">{formatBelgianDate(req.date)}</td>
                          <td className="p-2 text-slate-900">{req.staff_name}</td>
                          <td className="p-2 text-slate-600">
                            {req.slot === 'HELE_DAG' ? 'Hele dag' : req.slot}
                          </td>
                          <td className="p-2">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                              {req.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              {previewCount > 5 && (
                <p className="text-[11px] text-slate-400 italic text-right">
                  + nog {previewCount - 5} records verborgen in preview
                </p>
              )}
            </div>
          )}

          {/* PIN Confirmation Section */}
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-3">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-amber-200 text-amber-900 rounded-lg mt-0.5">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-950">
                  3. Beveiligingsbevestiging met Pincode
                </h4>
                <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
                  ⚠️ <strong>Let op:</strong> Het overstappen naar deze backup overschrijft de huidige{' '}
                  {mode === 'timesheets' ? 'tiktijden' : 'verlofaanvragen'} in het actieve systeem met de gegevens uit de backup.
                  Voer uw 4-cijferige beheerder-PIN code in om te bevestigen.
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 pt-1">
              <div className="relative flex-1">
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={8}
                  value={pinInput}
                  onChange={(e) => { setPinInput(e.target.value); setPinError(null); }}
                  placeholder="Voer 4-cijferige PIN code in"
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-center font-mono font-bold tracking-widest text-slate-800 text-base focus:ring-2 focus:ring-amber-500 focus:outline-none shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {pinError && (
              <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-lg text-rose-800 text-xs font-bold flex items-center space-x-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 text-rose-600" />
                <span>{pinError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Annuleren
          </button>

          <button
            type="button"
            onClick={handleConfirmRestore}
            disabled={isExecuting || previewCount === 0 || pinInput.trim().length === 0}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white text-xs font-black rounded-xl shadow-lg hover:shadow-xl disabled:shadow-none flex items-center space-x-2 transition-all"
          >
            {isExecuting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Bezig met overstappen...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4" />
                <span>PIN Bevestigen & Overstappen naar Backup</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
