/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { StaffMember, WeeklySchedule, DayOfWeekKey } from '../../types';
import { DAYS_OF_WEEK, getStaffWeeklyScheduledSlots } from '../../services/leaveService';
import {
  CalendarDays,
  Check,
  LayoutGrid,
  ListFilter,
  User
} from 'lucide-react';

interface FixedScheduleSubmoduleProps {
  staffList: StaffMember[];
  onSaveSchedule: (staffId: string, schedule: WeeklySchedule) => Promise<void>;
}

export const FixedScheduleSubmodule: React.FC<FixedScheduleSubmoduleProps> = ({
  staffList,
  onSaveSchedule
}) => {
  // View mode: 'matrix' (all staff in one compact grid) or 'single' (focused on 1 staff member)
  const [viewMode, setViewMode] = useState<'matrix' | 'single'>('matrix');

  // Selected staff for single view
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffList[0]?.id || '');

  // Local mirror of schedules for instant 0ms optimistic updates
  const [schedulesMap, setSchedulesMap] = useState<Record<string, WeeklySchedule>>(() => {
    const map: Record<string, WeeklySchedule> = {};
    staffList.forEach(s => {
      map[s.id] = s.schedule;
    });
    return map;
  });

  // Role filter in matrix view: 'all' | 'arts' | 'verpleegkundige'
  const [roleFilter, setRoleFilter] = useState<'all' | 'arts' | 'verpleegkundige'>('all');

  // Visual save indicator
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);

  // Sync schedules whenever staffList updates from Firestore
  useEffect(() => {
    const map: Record<string, WeeklySchedule> = {};
    staffList.forEach(s => {
      map[s.id] = s.schedule;
    });
    setSchedulesMap(map);
  }, [staffList]);

  // Ensure selectedStaffId is valid
  useEffect(() => {
    if (!staffList.some(s => s.id === selectedStaffId) && staffList.length > 0) {
      setSelectedStaffId(staffList[0].id);
    }
  }, [staffList, selectedStaffId]);

  // Direct 1-click toggle for any staff member, day, and slot (VM / NM)
  const handleToggleSlot = async (staffId: string, dayKey: DayOfWeekKey, slot: 'vm' | 'nm') => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    const currentSchedule = schedulesMap[staffId] || staff.schedule;
    const currentDay = currentSchedule[dayKey] || { vm: false, nm: false };
    const newSlotValue = !currentDay[slot];

    const updatedSchedule: WeeklySchedule = {
      ...currentSchedule,
      [dayKey]: {
        ...currentDay,
        [slot]: newSlotValue
      }
    };

    // 1. Instant optimistic update
    setSchedulesMap(prev => ({
      ...prev,
      [staffId]: updatedSchedule
    }));

    // 2. Feedback notice
    const slotName = slot.toUpperCase();
    const dayName = DAYS_OF_WEEK.find(d => d.key === dayKey)?.short || dayKey;
    setSavedFeedback(`${staff.name}: ${dayName} ${slotName} ${newSlotValue ? 'actief' : 'vrij'}`);
    setTimeout(() => {
      setSavedFeedback(prev => (prev?.startsWith(staff.name) ? null : prev));
    }, 2000);

    // 3. Persist to Firestore / backend
    try {
      await onSaveSchedule(staffId, updatedSchedule);
    } catch (err) {
      console.error('Fout bij opslaan van schema:', err);
    }
  };

  // Quick toggle whole day for single view
  const handleToggleWholeDay = async (staffId: string, dayKey: DayOfWeekKey) => {
    const staff = staffList.find(s => s.id === staffId);
    if (!staff) return;

    const currentSchedule = schedulesMap[staffId] || staff.schedule;
    const currentDay = currentSchedule[dayKey] || { vm: false, nm: false };
    const bothActive = currentDay.vm && currentDay.nm;

    const updatedSchedule: WeeklySchedule = {
      ...currentSchedule,
      [dayKey]: {
        vm: !bothActive,
        nm: !bothActive
      }
    };

    setSchedulesMap(prev => ({
      ...prev,
      [staffId]: updatedSchedule
    }));

    try {
      await onSaveSchedule(staffId, updatedSchedule);
    } catch (err) {
      console.error('Fout bij opslaan van schema:', err);
    }
  };

  // Filtered staff list
  const filteredStaff = staffList.filter(s => {
    if (roleFilter === 'arts') return s.role === 'arts';
    if (roleFilter === 'verpleegkundige') return s.role === 'verpleegkundige';
    return true;
  });

  const doctors = filteredStaff.filter(s => s.role === 'arts');
  const nurses = filteredStaff.filter(s => s.role === 'verpleegkundige');

  const selectedStaff = staffList.find(s => s.id === selectedStaffId) || staffList[0];
  const selectedSchedule = selectedStaff ? (schedulesMap[selectedStaff.id] || selectedStaff.schedule) : null;

  return (
    <div className="space-y-3">
      {/* COMPACT TOOLBAR */}
      <div className="bg-white px-3.5 py-2.5 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between flex-wrap gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
            <CalendarDays className="w-3.5 h-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-black text-slate-800 flex items-center gap-1.5">
              Vast Werkschema
            </h2>
          </div>
        </div>

        {/* Right side: Auto-save status + View toggles */}
        <div className="flex items-center gap-2">
          {savedFeedback && (
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 animate-in fade-in">
              <Check className="w-3 h-3" />
              {savedFeedback}
            </span>
          )}

          {/* View mode switcher */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'matrix'
                  ? 'bg-white text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Alle medewerkers in één compact overzicht"
            >
              <LayoutGrid className="w-3 h-3" />
              <span>Team Matrix</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('single')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'single'
                  ? 'bg-white text-indigo-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Gefocust op één medewerker"
            >
              <User className="w-3 h-3" />
              <span>Per Medewerker</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODE 1: COMPACT TEAM MATRIX (ALL STAFF TABLE) */}
      {/* ========================================================================= */}
      {viewMode === 'matrix' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {/* Sub-header with role filter */}
          <div className="px-3.5 py-2 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <ListFilter className="w-3.5 h-3.5 text-slate-500" />
              <span className="font-bold text-slate-700 text-[11px]">Filter:</span>
              <div className="flex items-center gap-1">
                {(['all', 'arts', 'verpleegkundige'] as const).map(f => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setRoleFilter(f)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition cursor-pointer capitalize ${
                      roleFilter === f
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {f === 'all' ? 'Alle personeel' : f === 'arts' ? 'Artsen' : 'Verpleegkundigen'}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-slate-500 font-medium">
              <div className="flex items-center gap-1">
                <span className="w-3 h-2.5 rounded bg-emerald-600 inline-block"></span>
                <span>Werkt</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-3 h-2.5 rounded bg-slate-100 border border-slate-200 inline-block"></span>
                <span>Vrij</span>
              </div>
            </div>
          </div>

          {/* Table Matrix */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50/90 text-slate-700 border-b border-slate-200 select-none">
                  <th className="p-2 pl-3 font-extrabold w-48 text-[11px]">Medewerker</th>
                  {DAYS_OF_WEEK.map(d => (
                    <th
                      key={d.key}
                      className="p-1.5 text-center font-extrabold border-l border-slate-200 text-[11px]"
                    >
                      <div>{d.label}</div>
                      <div className="flex items-center justify-center gap-1 text-[9px] text-slate-400 font-semibold mt-0.5">
                        <span className="w-6">VM</span>
                        <span className="w-6">NM</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* ARTSEN SECTION */}
                {doctors.length > 0 && (
                  <>
                    <tr className="bg-slate-100/70">
                      <td
                        colSpan={6}
                        className="py-1 px-3 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider"
                      >
                        👨‍⚕️ Artsen ({doctors.length})
                      </td>
                    </tr>
                    {doctors.map(member => {
                      const sched = schedulesMap[member.id] || member.schedule;
                      const activeSlots = getStaffWeeklyScheduledSlots(sched);

                      return (
                        <tr key={member.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="p-2 pl-3">
                            <div className="font-bold text-slate-800 text-xs truncate max-w-[170px]" title={member.name}>
                              {member.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              <span className="text-emerald-700 font-bold">{activeSlots}</span> / 10 dagdelen
                            </div>
                          </td>

                          {DAYS_OF_WEEK.map(d => {
                            const isVm = sched[d.key]?.vm ?? false;
                            const isNm = sched[d.key]?.nm ?? false;

                            return (
                              <td
                                key={d.key}
                                className="p-1 border-l border-slate-100 text-center align-middle"
                              >
                                <div className="flex items-center justify-center gap-1">
                                  {/* VM BUTTON */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSlot(member.id, d.key, 'vm')}
                                    className={`w-6 h-6 rounded text-[10px] font-extrabold transition cursor-pointer flex items-center justify-center ${
                                      isVm
                                        ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                                    }`}
                                    title={`${member.name} - ${d.label} VM: ${isVm ? 'Actief (klik voor vrij)' : 'Vrij (klik voor actief)'}`}
                                  >
                                    {isVm ? 'VM' : '—'}
                                  </button>

                                  {/* NM BUTTON */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSlot(member.id, d.key, 'nm')}
                                    className={`w-6 h-6 rounded text-[10px] font-extrabold transition cursor-pointer flex items-center justify-center ${
                                      isNm
                                        ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                                    }`}
                                    title={`${member.name} - ${d.label} NM: ${isNm ? 'Actief (klik voor vrij)' : 'Vrij (klik voor actief)'}`}
                                  >
                                    {isNm ? 'NM' : '—'}
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </>
                )}

                {/* VERPLEEGKUNDIGEN SECTION */}
                {nurses.length > 0 && (
                  <>
                    <tr className="bg-slate-100/70">
                      <td
                        colSpan={6}
                        className="py-1 px-3 text-[10px] font-extrabold text-slate-600 uppercase tracking-wider"
                      >
                        🩺 Verpleegkundigen ({nurses.length})
                      </td>
                    </tr>
                    {nurses.map(member => {
                      const sched = schedulesMap[member.id] || member.schedule;
                      const activeSlots = getStaffWeeklyScheduledSlots(sched);

                      return (
                        <tr key={member.id} className="hover:bg-indigo-50/20 transition-colors">
                          <td className="p-2 pl-3">
                            <div className="font-bold text-slate-800 text-xs truncate max-w-[170px]" title={member.name}>
                              {member.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-medium">
                              <span className="text-emerald-700 font-bold">{activeSlots}</span> / 10 dagdelen
                            </div>
                          </td>

                          {DAYS_OF_WEEK.map(d => {
                            const isVm = sched[d.key]?.vm ?? false;
                            const isNm = sched[d.key]?.nm ?? false;

                            return (
                              <td
                                key={d.key}
                                className="p-1 border-l border-slate-100 text-center align-middle"
                              >
                                <div className="flex items-center justify-center gap-1">
                                  {/* VM BUTTON */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSlot(member.id, d.key, 'vm')}
                                    className={`w-6 h-6 rounded text-[10px] font-extrabold transition cursor-pointer flex items-center justify-center ${
                                      isVm
                                        ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                                    }`}
                                    title={`${member.name} - ${d.label} VM: ${isVm ? 'Actief (klik voor vrij)' : 'Vrij (klik voor actief)'}`}
                                  >
                                    {isVm ? 'VM' : '—'}
                                  </button>

                                  {/* NM BUTTON */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleSlot(member.id, d.key, 'nm')}
                                    className={`w-6 h-6 rounded text-[10px] font-extrabold transition cursor-pointer flex items-center justify-center ${
                                      isNm
                                        ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                        : 'bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600'
                                    }`}
                                    title={`${member.name} - ${d.label} NM: ${isNm ? 'Actief (klik voor vrij)' : 'Vrij (klik voor actief)'}`}
                                  >
                                    {isNm ? 'NM' : '—'}
                                  </button>
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODE 2: COMPACT PER-MEDEWERKER VIEW */}
      {/* ========================================================================= */}
      {viewMode === 'single' && selectedStaff && selectedSchedule && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-3.5 space-y-3">
          {/* Medewerker selector bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 pb-2.5 border-b border-slate-100">
            <div className="flex items-center gap-2 overflow-x-auto py-0.5">
              {staffList.map(s => {
                const isCurrent = s.id === selectedStaffId;
                const sSched = schedulesMap[s.id] || s.schedule;
                const sSlots = getStaffWeeklyScheduledSlots(sSched);

                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStaffId(s.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{s.role === 'arts' ? '👨‍⚕️' : '🩺'}</span>
                    <span>{s.name}</span>
                    <span
                      className={`text-[10px] px-1 py-0.2 rounded font-extrabold ${
                        isCurrent ? 'bg-indigo-700 text-indigo-100' : 'bg-white text-slate-500'
                      }`}
                    >
                      {sSlots}d
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-xs font-bold text-slate-600">
              Totaal: <span className="text-emerald-700 font-extrabold">{getStaffWeeklyScheduledSlots(selectedSchedule)}</span> / 10 dagdelen
            </div>
          </div>

          {/* 5 Weekdays compact grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {DAYS_OF_WEEK.map(day => {
              const isVm = selectedSchedule[day.key]?.vm ?? false;
              const isNm = selectedSchedule[day.key]?.nm ?? false;
              const bothActive = isVm && isNm;

              return (
                <div
                  key={day.key}
                  className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/80 flex flex-col justify-between space-y-2"
                >
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/70">
                    <span className="font-extrabold text-xs text-slate-800">{day.label}</span>
                    <button
                      type="button"
                      onClick={() => handleToggleWholeDay(selectedStaff.id, day.key)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                      title="Klik om hele dag in- of uit te schakelen"
                    >
                      {bothActive ? 'Alles vrij' : 'Hele dag'}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {/* VM Clickable Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleSlot(selectedStaff.id, day.key, 'vm')}
                      className={`w-full py-1.5 px-2 rounded-md border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        isVm
                          ? 'bg-emerald-600 border-emerald-700 text-white shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <span>Voormiddag (VM)</span>
                      {isVm ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px]">—</span>}
                    </button>

                    {/* NM Clickable Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleSlot(selectedStaff.id, day.key, 'nm')}
                      className={`w-full py-1.5 px-2 rounded-md border text-xs font-bold transition flex items-center justify-between cursor-pointer ${
                        isNm
                          ? 'bg-emerald-600 border-emerald-700 text-white shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                      }`}
                    >
                      <span>Namiddag (NM)</span>
                      {isNm ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px]">—</span>}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
