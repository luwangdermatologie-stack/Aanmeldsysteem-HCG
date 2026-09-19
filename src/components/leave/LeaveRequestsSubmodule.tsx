/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  StaffMember,
  LeaveRequest,
  LeaveSlot,
  LeaveType,
  LeaveStatus,
  WeeklySchedule,
  DayOfWeekKey
} from '../../types';
import {
  DAYS_OF_WEEK,
  validateLeaveRequest,
  calculateCompulsoryLeaveCounter,
  getStaffWeeklyScheduledSlots
} from '../../services/leaveService';
import {
  Calendar,
  Clock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Trash2,
  Check,
  X,
  Filter,
  Save,
  Sparkles,
  Info,
  CalendarCheck,
  AlertTriangle,
  Award,
  Briefcase
} from 'lucide-react';

interface LeaveRequestsSubmoduleProps {
  staffList: StaffMember[];
  leaveRequests: LeaveRequest[];
  onAddLeaveRequest: (request: Omit<LeaveRequest, 'id' | 'created_at'>) => Promise<void>;
  onUpdateLeaveStatus: (requestId: string, newStatus: LeaveStatus) => Promise<void>;
  onDeleteLeaveRequest: (requestId: string) => Promise<void>;
  onUpdateStaffSchedule: (staffId: string, newSchedule: WeeklySchedule) => Promise<void>;
  initialSelectedStaffId?: string;
  initialDate?: string;
  initialSlot?: LeaveSlot;
}

export const LeaveRequestsSubmodule: React.FC<LeaveRequestsSubmoduleProps> = ({
  staffList,
  leaveRequests,
  onAddLeaveRequest,
  onUpdateLeaveStatus,
  onDeleteLeaveRequest,
  onUpdateStaffSchedule,
  initialSelectedStaffId,
  initialDate,
  initialSlot
}) => {
  // Selection for Leave Form
  const [selectedStaffId, setSelectedStaffId] = useState<string>(
    initialSelectedStaffId || staffList[0]?.id || ''
  );
  const [leaveDate, setLeaveDate] = useState<string>(
    initialDate || new Date().toISOString().slice(0, 10)
  );
  const [leaveSlot, setLeaveSlot] = useState<LeaveSlot>(initialSlot || 'HELE_DAG');
  const [leaveType, setLeaveType] = useState<LeaveType>('regulier');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected Staff for Weekly Schedule Editor
  const [scheduleStaffId, setScheduleStaffId] = useState<string>(
    initialSelectedStaffId || staffList[0]?.id || ''
  );
  const activeScheduleStaff = useMemo(
    () => staffList.find(s => s.id === scheduleStaffId),
    [staffList, scheduleStaffId]
  );
  const [editedSchedule, setEditedSchedule] = useState<WeeklySchedule | null>(null);
  const [scheduleSavedMsg, setScheduleSavedMsg] = useState(false);

  // Sync editedSchedule when staff selection changes
  React.useEffect(() => {
    if (activeScheduleStaff) {
      setEditedSchedule(JSON.parse(JSON.stringify(activeScheduleStaff.schedule)));
    }
  }, [activeScheduleStaff]);

  // Ensure selected staff IDs remain valid if staffList updates or finishes loading
  React.useEffect(() => {
    if (staffList.length > 0) {
      if (!selectedStaffId || !staffList.some(s => s.id === selectedStaffId)) {
        setSelectedStaffId(staffList[0].id);
      }
      if (!scheduleStaffId || !staffList.some(s => s.id === scheduleStaffId)) {
        setScheduleStaffId(staffList[0].id);
      }
    }
  }, [staffList, selectedStaffId, scheduleStaffId]);

  // Selected staff object for Leave Form
  const currentStaff = useMemo(
    () => staffList.find(s => s.id === selectedStaffId),
    [staffList, selectedStaffId]
  );

  // Filter states for the Requests Table
  const [tableFilterStaff, setTableFilterStaff] = useState<string>('all');
  const [tableFilterStatus, setTableFilterStatus] = useState<string>('all');
  const [tableFilterType, setTableFilterType] = useState<string>('all');

  // Filtered requests list
  const filteredRequests = useMemo(() => {
    return leaveRequests
      .filter(r => {
        if (tableFilterStaff !== 'all' && r.staff_id !== tableFilterStaff) return false;
        if (tableFilterStatus !== 'all' && r.status !== tableFilterStatus) return false;
        if (tableFilterType !== 'all' && r.type !== tableFilterType) return false;
        return true;
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [leaveRequests, tableFilterStaff, tableFilterStatus, tableFilterType]);

  // All nurses for the compulsory leave counter
  const nurses = useMemo(() => staffList.filter(s => s.role === 'verpleegkundige'), [staffList]);

  // Real-time schedule validation check for the currently selected inputs
  const liveValidation = useMemo(() => {
    if (!currentStaff || !leaveDate) return { valid: true };
    return validateLeaveRequest(currentStaff, leaveDate, leaveSlot, leaveType);
  }, [currentStaff, leaveDate, leaveSlot, leaveType]);

  // Reset leave type to 'regulier' if an 'arts' is selected
  React.useEffect(() => {
    if (currentStaff?.role === 'arts' && leaveType === 'verplicht') {
      setLeaveType('regulier');
    }
  }, [currentStaff?.role, leaveType]);

  // Submit Leave Request
  const handleSubmitLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!currentStaff) {
      setFormError('Selecteer een personeelslid.');
      return;
    }

    // Run strict schedule validation
    const validation = validateLeaveRequest(currentStaff, leaveDate, leaveSlot, leaveType);
    if (!validation.valid) {
      setFormError(validation.error || 'Aanvraag is niet geldig volgens het werkschema.');
      return;
    }

    // Check duplicate
    const existing = leaveRequests.find(
      r => r.staff_id === currentStaff.id && r.date === leaveDate && r.status !== 'afgekeurd'
    );
    if (existing) {
      setFormError(`Er bestaat al een verlofaanvraag voor ${currentStaff.name} op ${leaveDate} (${existing.slot}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      const units = leaveSlot === 'HELE_DAG' ? 1.0 : 0.5;
      await onAddLeaveRequest({
        staff_id: currentStaff.id,
        staff_name: currentStaff.name,
        date: leaveDate,
        slot: leaveSlot,
        units,
        type: leaveType,
        status: 'aangevraagd'
      });

      setFormSuccess(`Verlofaanvraag voor ${currentStaff.name} (${leaveDate}, ${leaveSlot}) succesvol ingevoerd!`);
      setTimeout(() => setFormSuccess(null), 4000);
    } catch (err: any) {
      setFormError(err.message || 'Fout bij opslaan verlofaanvraag.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle day schedule slot
  const handleScheduleToggle = (dayKey: DayOfWeekKey, slot: 'vm' | 'nm') => {
    if (!editedSchedule) return;
    setEditedSchedule(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        [dayKey]: {
          ...prev[dayKey],
          [slot]: !prev[dayKey][slot]
        }
      };
    });
    setScheduleSavedMsg(false);
  };

  // Save modified schedule
  const handleSaveSchedule = async () => {
    if (!activeScheduleStaff || !editedSchedule) return;
    try {
      await onUpdateStaffSchedule(activeScheduleStaff.id, editedSchedule);
      setScheduleSavedMsg(true);
      setTimeout(() => setScheduleSavedMsg(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TELLER VERPLICHT VERLOF (VERPLEEGKUNDIGEN) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
              <Award className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm">
                Teller Verplicht Verlof (Verpleegkundigen)
              </h3>
              <p className="text-[11px] text-slate-500">
                Continue cumulatieve teller van alle opgenomen halve dagen (0.5 per VM/NM) aan verplicht verlof
              </p>
            </div>
          </div>
          <span className="text-xs bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-full font-bold">
            {nurses.length} Verpleegkundigen actief
          </span>
        </div>

        {/* Nurses Counter Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {nurses.map(nurse => {
            const counter = calculateCompulsoryLeaveCounter(nurse.id, leaveRequests);
            return (
              <div
                key={nurse.id}
                className="bg-slate-50/70 border border-slate-200/90 rounded-xl p-4 hover:border-amber-300 hover:bg-amber-50/30 transition shadow-2xs"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-800 text-xs truncate">{nurse.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold">
                    Verpleegkundige
                  </span>
                </div>

                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-amber-600">
                    {counter.totalApprovedDays}
                  </span>
                  <span className="text-xs font-bold text-slate-600">dagen</span>
                  <span className="text-xs font-semibold text-slate-400">
                    ({counter.totalApprovedHalfDays} halve dagen)
                  </span>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Goedgekeurd: <strong className="text-slate-700">{counter.approvedCount}</strong></span>
                  {counter.pendingCount > 0 ? (
                    <span className="text-amber-700 font-bold bg-amber-100/80 px-1.5 py-0.2 rounded text-[10px]">
                      {counter.pendingCount} in aanvraag ({counter.totalPendingDays}d)
                    </span>
                  ) : (
                    <span className="text-slate-400 text-[10px]">0 in aanvraag</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TWEE KOLOMMEN: VERLOF INVOEREN (LINKS) & VAST WERKSCHEMA (RECHTS) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* LINKER KOLOM: VERLOF INVOEREN MET SCHEMA VALIDATIE */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col">
          <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-slate-100">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Verlof Invoeren</h3>
              <p className="text-[11px] text-slate-500">Automatische validatie tegen het vaste werkschema</p>
            </div>
          </div>

          <form onSubmit={handleSubmitLeave} className="space-y-4 flex-1 flex flex-col justify-between">
            <div className="space-y-3.5">
              {/* Personeelslid kiezen */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Personeelslid <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedStaffId}
                  onChange={e => {
                    setSelectedStaffId(e.target.value);
                    setFormError(null);
                  }}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.role === 'arts' ? '👨‍⚕️ Arts: ' : '🩺 Verpleegkundige: '} {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Datum & Dagdeel */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Datum <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={leaveDate}
                    onChange={e => {
                      const val = e.target.value;
                      if (val) {
                        const [y, m, d] = val.split('-').map(Number);
                        const day = new Date(y, m - 1, d).getDay();
                        if (day === 0 || day === 6) {
                          setFormError('Zaterdag en zondag maken geen deel uit van de werk- en verlofplanning. Selecteer een werkdag (maandag t/m vrijdag).');
                        } else {
                          setFormError(null);
                        }
                      } else {
                        setFormError(null);
                      }
                      setLeaveDate(val);
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Uitsluitend weekdagen (maandag t/m vrijdag).</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Dagdeel <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={leaveSlot}
                    onChange={e => {
                      setLeaveSlot(e.target.value as LeaveSlot);
                      setFormError(null);
                    }}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="HELE_DAG">Hele Dag (1.0 dag)</option>
                    <option value="VM">Voormiddag (VM - 0.5 dag)</option>
                    <option value="NM">Namiddag (NM - 0.5 dag)</option>
                  </select>
                </div>
              </div>

              {/* Verloftype Keuze: Regulier vs Verplicht */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Type Verlof of Extra Werkdag <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold cursor-pointer transition ${
                      leaveType === 'regulier'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-900 shadow-2xs'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="leaveType"
                      value="regulier"
                      checked={leaveType === 'regulier'}
                      onChange={() => setLeaveType('regulier')}
                      className="text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>Regulier Verlof</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition ${
                      currentStaff?.role === 'arts'
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : leaveType === 'verplicht'
                        ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-2xs cursor-pointer'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                    }`}
                    title={
                      currentStaff?.role === 'arts'
                        ? 'Verplicht verlof is enkel selecteerbaar voor verpleegkundigen'
                        : 'Verplicht verlof voor verpleegkundigen (+ teller)'
                    }
                  >
                    <input
                      type="radio"
                      name="leaveType"
                      value="verplicht"
                      disabled={currentStaff?.role === 'arts'}
                      checked={leaveType === 'verplicht'}
                      onChange={() => setLeaveType('verplicht')}
                      className="text-amber-600 focus:ring-amber-500 disabled:opacity-50"
                    />
                    <span>Verplicht Verlof</span>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-bold transition ${
                      currentStaff?.role === 'arts'
                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : leaveType === 'gecompenseerd'
                        ? 'bg-teal-50 border-teal-400 text-teal-900 shadow-2xs cursor-pointer'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 cursor-pointer'
                    }`}
                    title={
                      currentStaff?.role === 'arts'
                        ? 'Gecompenseerde werkdagen zijn enkel voor verpleegkundigen'
                        : 'Extra moment komen werken (- teller verplicht verlof)'
                    }
                  >
                    <input
                      type="radio"
                      name="leaveType"
                      value="gecompenseerd"
                      disabled={currentStaff?.role === 'arts'}
                      checked={leaveType === 'gecompenseerd'}
                      onChange={() => setLeaveType('gecompenseerd')}
                      className="text-teal-600 focus:ring-teal-500 disabled:opacity-50"
                    />
                    <div className="flex items-center gap-1">
                      <Briefcase className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                      <span>Gecompenseerd</span>
                    </div>
                  </label>
                </div>
                {currentStaff?.role === 'arts' ? (
                  <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-blue-500" />
                    Artsen kunnen enkel regulier verlof selecteren.
                  </p>
                ) : leaveType === 'gecompenseerd' ? (
                  <p className="text-[11px] text-teal-700 font-medium mt-1 flex items-center gap-1">
                    <Info className="w-3.5 h-3.5 text-teal-600" />
                    Extra moment komen werken: trekt automatisch af van de verplicht verlof teller.
                  </p>
                ) : null}
              </div>

              {/* Real-time feedback banner */}
              {!liveValidation.valid ? (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Niet mogelijk:</span>
                    <p className="mt-0.5 text-[11px] leading-relaxed">{liveValidation.error}</p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-medium">
                    {leaveType === 'gecompenseerd'
                      ? `${currentStaff?.name} is vrij op dit dagdeel en kan extra komen werken (gecompenseerde werkdag).`
                      : `${currentStaff?.name} staat ingeroosterd op dit dagdeel.`}
                  </span>
                </div>
              )}

              {formError && (
                <div className="p-2.5 bg-rose-100 border border-rose-300 rounded-xl text-rose-900 text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-2.5 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>{formSuccess}</span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !liveValidation.valid}
              className="w-full mt-4 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <CalendarCheck className="w-4 h-4" />
              {isSubmitting ? 'Aanvraag opslaan...' : 'Verlofaanvraag Indienen'}
            </button>
          </form>
        </div>

        {/* RECHTER KOLOM: VAST WERKSCHEMA INSTELLEN */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Vast Werkschema Instellen</h3>
                  <p className="text-[11px] text-slate-500">Configureer per dag VM / NM aanwezigheid</p>
                </div>
              </div>

              {/* Selector for Staff */}
              <select
                value={scheduleStaffId}
                onChange={e => setScheduleStaffId(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 font-bold text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500 max-w-[190px]"
              >
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role === 'arts' ? 'Arts' : 'Verpl.'})
                  </option>
                ))}
              </select>
            </div>

            {/* Total slots indicator */}
            {editedSchedule && (
              <div className="mb-3 flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <span className="font-bold text-slate-600">Wekelijks werkschema:</span>
                <span className="font-extrabold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                  {getStaffWeeklyScheduledSlots(editedSchedule)} / 10 dagdelen actief
                </span>
              </div>
            )}

            {/* Checkboxes Matrix */}
            {editedSchedule && (
              <div className="space-y-1.5 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {DAYS_OF_WEEK.map(({ key, label }) => {
                  const daySched = editedSchedule[key] || { vm: false, nm: false };
                  const isDayFull = daySched.vm && daySched.nm;

                  return (
                    <div
                      key={key}
                      className={`p-2.5 flex items-center justify-between transition ${
                        daySched.vm || daySched.nm ? 'bg-white' : 'bg-slate-50/70 text-slate-400'
                      }`}
                    >
                      <span className="font-bold text-slate-800 w-28">{label}</span>
                      <div className="flex items-center gap-4">
                        {/* VM Checkbox */}
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={daySched.vm}
                            onChange={() => handleScheduleToggle(key, 'vm')}
                            className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                          />
                          <span className="text-xs">VM (Voormiddag)</span>
                        </label>

                        {/* NM Checkbox */}
                        <label className="flex items-center gap-1.5 cursor-pointer font-semibold text-slate-700 select-none">
                          <input
                            type="checkbox"
                            checked={daySched.nm}
                            onChange={() => handleScheduleToggle(key, 'nm')}
                            className="rounded text-teal-600 focus:ring-teal-500 h-4 w-4"
                          />
                          <span className="text-xs">NM (Namiddag)</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
            {scheduleSavedMsg ? (
              <span className="text-xs text-emerald-700 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Vast werkschema succesvol opgeslagen!
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">
                Wijzigingen worden direct doorgevoerd in het weekrooster
              </span>
            )}

            <button
              type="button"
              onClick={handleSaveSchedule}
              className="py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Save className="w-4 h-4" />
              Schema Opslaan
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. OVERZICHT VERLOFAANVRAGEN & STATUS CONTROLS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Filters */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <span className="font-bold text-slate-800 text-xs">Filter Verlofaanvragen:</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap text-xs">
            {/* Staff Filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500 font-semibold">Medewerker:</label>
              <select
                value={tableFilterStaff}
                onChange={e => setTableFilterStaff(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-medium"
              >
                <option value="all">Iedereen ({leaveRequests.length})</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500 font-semibold">Status:</label>
              <select
                value={tableFilterStatus}
                onChange={e => setTableFilterStatus(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-medium"
              >
                <option value="all">Alle Statussen</option>
                <option value="aangevraagd">In Aanvraag</option>
                <option value="goedgekeurd">Goedgekeurd</option>
                <option value="afgekeurd">Afgekeurd</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-slate-500 font-semibold">Type:</label>
              <select
                value={tableFilterType}
                onChange={e => setTableFilterType(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg p-1.5 text-xs text-slate-700 font-medium"
              >
                <option value="all">Alle Types</option>
                <option value="regulier">Regulier Verlof</option>
                <option value="verplicht">Verplicht Verlof</option>
                <option value="gecompenseerd">Gecompenseerde Werkdag</option>
              </select>
            </div>
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-100/80 border-b border-slate-200 font-bold text-slate-700">
                <th className="p-3">Datum</th>
                <th className="p-3">Personeelslid</th>
                <th className="p-3">Rol</th>
                <th className="p-3">Dagdeel</th>
                <th className="p-3">Eenheden</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Acties</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredRequests.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-slate-400">
                    Geen verlofaanvragen gevonden voor de geselecteerde filters.
                  </td>
                </tr>
              ) : (
                filteredRequests.map(req => {
                  const staff = staffList.find(s => s.id === req.staff_id);
                  const isNurse = staff?.role === 'verpleegkundige';

                  return (
                    <tr key={req.id} className="hover:bg-slate-50 transition">
                      <td className="p-3 font-bold text-slate-800">
                        {req.date}
                      </td>
                      <td className="p-3 font-semibold text-slate-800">
                        {req.staff_name || staff?.name || 'Onbekend'}
                      </td>
                      <td className="p-3">
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold border ${
                            staff?.role === 'arts'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {staff?.role === 'arts' ? 'Arts' : 'Verpleegkundige'}
                        </span>
                      </td>
                      <td className="p-3 font-medium text-slate-700">
                        {req.slot === 'HELE_DAG'
                          ? 'Hele dag'
                          : req.slot === 'VM'
                          ? 'Voormiddag (VM)'
                          : 'Namiddag (NM)'}
                      </td>
                      <td className="p-3 font-bold text-slate-700">
                        {req.units} dag
                      </td>
                      <td className="p-3">
                        {req.type === 'gecompenseerd' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-900 border border-teal-300 flex items-center gap-1 w-fit">
                            <Briefcase className="w-3 h-3 text-teal-700" />
                            Gecompenseerd (-{req.units}d)
                          </span>
                        ) : req.type === 'verplicht' ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            Verplicht Verlof
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Regulier
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {req.status === 'goedgekeurd' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            Goedgekeurd
                          </span>
                        )}
                        {req.status === 'aangevraagd' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit">
                            <Clock className="w-3 h-3 text-amber-600" />
                            In Aanvraag
                          </span>
                        )}
                        {req.status === 'afgekeurd' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200 flex items-center gap-1 w-fit">
                            <X className="w-3 h-3 text-rose-600" />
                            Afgekeurd
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {req.status !== 'goedgekeurd' && (
                            <button
                              type="button"
                              onClick={() => onUpdateLeaveStatus(req.id, 'goedgekeurd')}
                              className="p-1 px-2 text-[10px] font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition cursor-pointer flex items-center gap-1 shadow-2xs"
                              title="Goedkeuren"
                            >
                              <Check className="w-3 h-3" />
                              Goedkeuren
                            </button>
                          )}
                          {req.status !== 'afgekeurd' && (
                            <button
                              type="button"
                              onClick={() => onUpdateLeaveStatus(req.id, 'afgekeurd')}
                              className="p-1 px-2 text-[10px] font-bold rounded-lg bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition cursor-pointer flex items-center gap-1"
                              title="Afkeuren"
                            >
                              <X className="w-3 h-3" />
                              Afkeuren
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onDeleteLeaveRequest(req.id)}
                            className="p-1 text-slate-400 hover:text-red-600 transition cursor-pointer"
                            title="Verwijderen"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
