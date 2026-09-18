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
  LeaveStatus
} from '../../types';
import {
  MONTH_NAMES_NL,
  getMonthCalendarWeeks,
  getStaffColorConfig,
  validateLeaveRequest,
  MonthCalendarWeek
} from '../../services/leaveService';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Trash2,
  Check,
  AlertCircle
} from 'lucide-react';

interface MonthOverviewSubmoduleProps {
  staffList: StaffMember[];
  leaveRequests: LeaveRequest[];
  onDirectSetLeave?: (
    staffId: string,
    staffName: string,
    date: string,
    slot: LeaveSlot,
    type: LeaveType,
    note?: string
  ) => Promise<void>;
  onDirectCancelLeave?: (requestId: string) => Promise<void>;
  onUpdateStatus?: (requestId: string, newStatus: LeaveStatus, note?: string) => Promise<void>;
}

interface WeekSpan {
  id: string;
  staff: StaffMember;
  color: string;
  startIndex: number; // 0-indexed sub-unit (0 to totalHalfCols - 1)
  endIndex: number;   // 0-indexed sub-unit
  span: number;       // total sub-units (1 = half day, 2 = whole day, etc.)
  requests: LeaveRequest[];
  trackIndex: number;
  isHalfDay: boolean;
  halfDayType?: 'VM' | 'NM';
  displaySummary: string;
}

export const MonthOverviewSubmodule: React.FC<MonthOverviewSubmoduleProps> = ({
  staffList,
  leaveRequests,
  onDirectSetLeave,
  onDirectCancelLeave,
  onUpdateStatus
}) => {
  // Current viewed month & year
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Filters
  const [selectedStaffId, setSelectedStaffId] = useState<string>('all');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<'all' | 'arts' | 'verpleegkundige'>('all');
  const includeWeekends = false;

  // Selected leave detail modal
  const [activeSpanModal, setActiveSpanModal] = useState<WeekSpan | null>(null);

  // Quick Add leave modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addStaffId, setAddStaffId] = useState(staffList[0]?.id || '');
  const [addDate, setAddDate] = useState('');
  const [addSlot, setAddSlot] = useState<LeaveSlot>('HELE_DAG');
  const [addType, setAddType] = useState<LeaveType>('regulier');
  const [addNote, setAddNote] = useState('');
  const [addError, setAddError] = useState('');
  const [isSavingLeave, setIsSavingLeave] = useState(false);

  // Month navigation
  const handlePrevMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleGoToToday = () => {
    setCurrentDate(new Date());
  };

  // Build calendar weeks for current month
  const calendarWeeks: MonthCalendarWeek[] = useMemo(() => {
    return getMonthCalendarWeeks(year, month, includeWeekends);
  }, [year, month, includeWeekends]);

  // Color map for each staff member for quick lookup
  const staffColorMap = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getStaffColorConfig>>();
    staffList.forEach((s, idx) => {
      map.set(s.id, getStaffColorConfig(s, idx));
    });
    return map;
  }, [staffList]);

  // Map of leave requests grouped by dateStr: "YYYY-MM-DD" -> LeaveRequest[]
  const leavesByDate = useMemo(() => {
    const map = new Map<string, LeaveRequest[]>();

    leaveRequests.forEach(req => {
      if (req.status === 'afgekeurd') return;

      const staff = staffList.find(s => s.id === req.staff_id);
      if (!staff) return;

      if (selectedRoleFilter !== 'all' && staff.role !== selectedRoleFilter) return;
      if (selectedStaffId !== 'all' && req.staff_id !== selectedStaffId) return;

      const existing = map.get(req.date) || [];
      existing.push(req);
      map.set(req.date, existing);
    });

    return map;
  }, [leaveRequests, staffList, selectedRoleFilter, selectedStaffId]);

  // Compute multi-day and half-day spans for each week
  const weekSpansMap = useMemo(() => {
    const map = new Map<string, { spans: WeekSpan[]; maxTracks: number }>();

    calendarWeeks.forEach(week => {
      const spans: Omit<WeekSpan, 'trackIndex'>[] = [];

      staffList.forEach(staff => {
        if (selectedStaffId !== 'all' && staff.id !== selectedStaffId) return;
        if (selectedRoleFilter !== 'all' && staff.role !== selectedRoleFilter) return;

        interface DaySlotUnit {
          subUnitIndex: number;
          dayIndex: number;
          slotType: 'VM' | 'NM';
          dateStr: string;
          request: LeaveRequest;
        }

        const units: DaySlotUnit[] = [];

        week.days.forEach((day, dayIndex) => {
          const dayLeaves = leavesByDate.get(day.dateStr) || [];
          const staffLeaves = dayLeaves.filter(l => l.staff_id === staff.id);

          staffLeaves.forEach(req => {
            if (req.slot === 'VM' || req.slot === 'HELE_DAG') {
              units.push({
                subUnitIndex: dayIndex * 2,
                dayIndex,
                slotType: 'VM',
                dateStr: day.dateStr,
                request: req
              });
            }
            if (req.slot === 'NM' || req.slot === 'HELE_DAG') {
              units.push({
                subUnitIndex: dayIndex * 2 + 1,
                dayIndex,
                slotType: 'NM',
                dateStr: day.dateStr,
                request: req
              });
            }
          });
        });

        if (units.length === 0) return;

        // Sort by subUnitIndex
        units.sort((a, b) => a.subUnitIndex - b.subUnitIndex);

        // Deduplicate in case of duplicate entries
        const uniqueUnits: DaySlotUnit[] = [];
        units.forEach(u => {
          if (!uniqueUnits.some(existing => existing.subUnitIndex === u.subUnitIndex)) {
            uniqueUnits.push(u);
          }
        });

        if (uniqueUnits.length === 0) return;

        const buildSpanObject = (
          start: number,
          end: number,
          reqs: LeaveRequest[],
          unitList: DaySlotUnit[]
        ): Omit<WeekSpan, 'trackIndex'> => {
          const spanLength = end - start + 1;
          const isHalfDay = spanLength === 1;
          const halfDayType = isHalfDay ? unitList[0].slotType : undefined;

          let displaySummary = '';
          if (isHalfDay) {
            displaySummary = `${unitList[0].dateStr} (${halfDayType})`;
          } else if (reqs.length === 1 && reqs[0].slot === 'HELE_DAG') {
            displaySummary = `${reqs[0].date} (Hele dag)`;
          } else {
            const firstDate = unitList[0].dateStr;
            const lastDate = unitList[unitList.length - 1].dateStr;
            displaySummary = `${firstDate} t/m ${lastDate}`;
          }

          const colorCfg = staffColorMap.get(staff.id) || getStaffColorConfig(staff);

          return {
            id: `${staff.id}-${week.weekIdentifier}-${start}-${end}`,
            staff,
            color: colorCfg.hex,
            startIndex: start,
            endIndex: end,
            span: spanLength,
            requests: reqs,
            isHalfDay,
            halfDayType,
            displaySummary
          };
        };

        // Group consecutive half-days into continuous spans
        let currentSpanStart = uniqueUnits[0].subUnitIndex;
        let currentSpanEnd = uniqueUnits[0].subUnitIndex;
        let currentRequests: LeaveRequest[] = [uniqueUnits[0].request];
        let currentUnits: DaySlotUnit[] = [uniqueUnits[0]];

        for (let i = 1; i < uniqueUnits.length; i++) {
          const curr = uniqueUnits[i];
          if (curr.subUnitIndex === currentSpanEnd + 1) {
            // Consecutive half-day: continue the unbroken line
            currentSpanEnd = curr.subUnitIndex;
            if (!currentRequests.some(r => r.id === curr.request.id)) {
              currentRequests.push(curr.request);
            }
            currentUnits.push(curr);
          } else {
            // Gap: push previous span and start new
            spans.push(buildSpanObject(currentSpanStart, currentSpanEnd, currentRequests, currentUnits));
            currentSpanStart = curr.subUnitIndex;
            currentSpanEnd = curr.subUnitIndex;
            currentRequests = [curr.request];
            currentUnits = [curr];
          }
        }

        // Push the final span
        spans.push(buildSpanObject(currentSpanStart, currentSpanEnd, currentRequests, currentUnits));
      });

      // Sort spans: earliest first, then longest first
      spans.sort((a, b) => {
        if (a.startIndex !== b.startIndex) return a.startIndex - b.startIndex;
        return b.span - a.span;
      });

      // Allocate tracks (lanes) to prevent overlaps
      const tracks: number[] = [];
      const allocatedSpans: WeekSpan[] = spans.map(s => {
        let trackIndex = tracks.findIndex(lastEnd => lastEnd < s.startIndex);
        if (trackIndex === -1) {
          trackIndex = tracks.length;
          tracks.push(s.endIndex);
        } else {
          tracks[trackIndex] = s.endIndex;
        }
        return {
          ...s,
          trackIndex
        };
      });

      map.set(week.weekIdentifier, {
        spans: allocatedSpans,
        maxTracks: Math.max(tracks.length, 1)
      });
    });

    return map;
  }, [calendarWeeks, staffList, leavesByDate, staffColorMap, selectedStaffId, selectedRoleFilter]);

  // Open Add Leave on specific day and optional slot
  const handleOpenAddForDay = (dateStr: string, slot: LeaveSlot = 'HELE_DAG') => {
    setAddDate(dateStr);
    setAddStaffId(selectedStaffId !== 'all' ? selectedStaffId : (staffList[0]?.id || ''));
    setAddSlot(slot);
    setAddType('regulier');
    setAddNote('');
    setAddError('');
    setIsAddModalOpen(true);
  };

  // Submit direct leave
  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onDirectSetLeave) return;

    const staff = staffList.find(s => s.id === addStaffId);
    if (!staff) {
      setAddError('Selecteer een personeelslid');
      return;
    }

    const validation = validateLeaveRequest(staff, addDate, addSlot, addType);
    if (!validation.valid) {
      setAddError(validation.error || 'Ongeldige aanvraag');
      return;
    }

    setIsSavingLeave(true);
    setAddError('');
    try {
      await onDirectSetLeave(staff.id, staff.name, addDate, addSlot, addType, addNote.trim() || undefined);
      setIsAddModalOpen(false);
    } catch (err: any) {
      setAddError(err.message || 'Fout bij opslaan verlof');
    } finally {
      setIsSavingLeave(false);
    }
  };

  const totalCols = includeWeekends ? 7 : 5;
  const totalHalfCols = totalCols * 2;

  return (
    <div className="space-y-3">
      {/* ========================================================================= */}
      {/* 1. COMPACT HEADER & KORTE LEGENDE */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs px-4 py-3 flex flex-col gap-2.5">
        {/* Top bar: Month navigation + Actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-1.5">
              <span>{MONTH_NAMES_NL[month]}</span>
              <span className="text-slate-400 font-medium">{year}</span>
            </h2>

            <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 rounded hover:bg-white text-slate-700 transition cursor-pointer"
                title="Vorige maand"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleGoToToday}
                className="px-1.5 py-0.5 text-[11px] font-bold text-slate-700 hover:bg-white rounded transition cursor-pointer"
                title="Vandaag"
              >
                Vandaag
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 rounded hover:bg-white text-slate-700 transition cursor-pointer"
                title="Volgende maand"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick role toggle */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-[11px] font-semibold text-slate-600 border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedRoleFilter('all')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${selectedRoleFilter === 'all' ? 'bg-white font-bold text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Alles
              </button>
              <button
                type="button"
                onClick={() => setSelectedRoleFilter('arts')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${selectedRoleFilter === 'arts' ? 'bg-white font-bold text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Artsen
              </button>
              <button
                type="button"
                onClick={() => setSelectedRoleFilter('verpleegkundige')}
                className={`px-2 py-0.5 rounded cursor-pointer transition ${selectedRoleFilter === 'verpleegkundige' ? 'bg-white font-bold text-slate-900 shadow-xs' : 'hover:text-slate-900'}`}
              >
                Verpl.
              </button>
            </div>
          </div>
        </div>

        {/* Short & Clean Legend: purely Name + Color */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100 flex-wrap">
          <button
            type="button"
            onClick={() => setSelectedStaffId('all')}
            className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
              selectedStaffId === 'all'
                ? 'bg-slate-900 text-white font-bold'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Alle
          </button>

          {staffList.map(staff => {
            const colorCfg = staffColorMap.get(staff.id) || getStaffColorConfig(staff);
            const isSelected = selectedStaffId === staff.id;

            return (
              <button
                key={staff.id}
                type="button"
                onClick={() => setSelectedStaffId(isSelected ? 'all' : staff.id)}
                className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer border ${
                  isSelected
                    ? 'ring-2 ring-slate-800 bg-white border-slate-300 shadow-xs'
                    : 'bg-white border-slate-200/80 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: colorCfg.hex }}
                />
                <span className="truncate max-w-[120px]">{staff.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAANDOVERZICHT IN 2x2 FORMATIE (2 WEKEN NAAST ELKAAR, 2 ERONDER) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {calendarWeeks.map(week => {
          const weekData = weekSpansMap.get(week.weekIdentifier) || { spans: [], maxTracks: 1 };
          const { spans, maxTracks } = weekData;

          return (
            <div
              key={week.weekIdentifier}
              className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col"
            >
              {/* Compact Week Header */}
              <div className="bg-slate-50/90 px-3 py-1.5 border-b border-slate-200/90 flex items-center justify-between text-xs">
                <span className="font-extrabold text-slate-800">
                  Week {week.weekNumber}
                </span>
                <span className="text-[11px] font-semibold text-slate-500">
                  {week.dateRangeLabel}
                </span>
              </div>

              {/* Day Columns Header Row (e.g. Ma 14, Di 15...) with VM / NM indicators */}
              <div
                className={`grid ${
                  includeWeekends ? 'grid-cols-7' : 'grid-cols-5'
                } divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/40 text-center select-none`}
              >
                {week.days.map(day => (
                  <div
                    key={day.dateStr}
                    className={`py-1 px-0.5 flex flex-col items-center justify-center transition ${
                      !day.isCurrentMonth
                        ? 'opacity-40'
                        : day.isToday
                        ? 'bg-blue-50/40'
                        : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleOpenAddForDay(day.dateStr, 'HELE_DAG')}
                      className="flex flex-col items-center cursor-pointer hover:opacity-80 transition"
                      title={`+ Hele dag verlof op ${day.dateStr}`}
                    >
                      <span className="text-[10px] font-semibold text-slate-400">
                        {day.dayShort}
                      </span>
                      <span
                        className={`text-[11px] font-black leading-tight ${
                          day.isToday
                            ? 'w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px]'
                            : day.isCurrentMonth
                            ? 'text-slate-700'
                            : 'text-slate-400'
                        }`}
                      >
                        {day.dayOfMonth}
                      </span>
                    </button>

                    {/* Subtle VM / NM quick buttons */}
                    <div className="w-full grid grid-cols-2 text-[8px] font-bold text-slate-400/80 mt-0.5 leading-none border-t border-slate-100/80 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleOpenAddForDay(day.dateStr, 'VM')}
                        className="hover:text-indigo-600 hover:bg-indigo-50/70 rounded-xs py-0.5 transition cursor-pointer"
                        title={`+ VM verlof op ${day.dateStr}`}
                      >
                        vm
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenAddForDay(day.dateStr, 'NM')}
                        className="hover:text-indigo-600 hover:bg-indigo-50/70 rounded-xs py-0.5 transition cursor-pointer"
                        title={`+ NM verlof op ${day.dateStr}`}
                      >
                        nm
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Day Lanes Body with Spanning Lines */}
              <div className="relative flex-1 min-h-[76px]">
                {/* Background Day Columns with subtle VM/NM division */}
                <div
                  className={`absolute inset-0 grid ${
                    includeWeekends ? 'grid-cols-7' : 'grid-cols-5'
                  } divide-x divide-slate-100 pointer-events-none`}
                >
                  {week.days.map((day, idx) => (
                    <div
                      key={idx}
                      className={`h-full grid grid-cols-2 divide-x divide-slate-100/50 ${
                        !day.isCurrentMonth
                          ? 'bg-slate-50/40'
                          : day.isToday
                          ? 'bg-blue-50/15'
                          : ''
                      }`}
                    >
                      <div className="h-full" />
                      <div className="h-full" />
                    </div>
                  ))}
                </div>

                {/* Foreground Multi-Day / Half-Day Colored Spans */}
                <div
                  className="relative grid gap-y-1 p-1.5"
                  style={{
                    gridTemplateColumns: `repeat(${totalHalfCols}, minmax(0, 1fr))`,
                    columnGap: '2px',
                    gridAutoRows: '20px'
                  }}
                >
                  {spans.map(span => (
                    <div
                      key={span.id}
                      onClick={() => setActiveSpanModal(span)}
                      style={{
                        gridColumnStart: span.startIndex + 1,
                        gridColumnEnd: span.endIndex + 2,
                        gridRowStart: span.trackIndex + 1,
                        backgroundColor: span.color
                      }}
                      className={`h-[19px] ${
                        span.isHalfDay ? 'px-1 text-[9px] sm:text-[10px]' : 'px-1.5 text-[11px]'
                      } rounded-xs flex items-center text-white font-bold shadow-2xs hover:brightness-105 active:scale-[0.99] cursor-pointer transition-all overflow-hidden z-10`}
                      title={`${span.staff.name} (${span.displaySummary})`}
                    >
                      <span className="truncate leading-none drop-shadow-xs">
                        {span.staff.name}
                      </span>
                    </div>
                  ))}

                  {spans.length === 0 && (
                    <div className="col-span-full h-12 flex items-center justify-center text-slate-300 text-[11px] italic select-none">
                      Geen verlof
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 3. DETAIL MODAL (Wanneer op een verloflijn geklikt wordt) */}
      {/* ========================================================================= */}
      {activeSpanModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full shrink-0"
                  style={{ backgroundColor: activeSpanModal.color }}
                />
                <h3 className="font-extrabold text-slate-900 text-sm">
                  {activeSpanModal.staff.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSpanModal(null)}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200/80 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Periode:</span>
                  <span className="font-bold text-slate-800">
                    {activeSpanModal.displaySummary}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Duur:</span>
                  <span className="font-bold text-slate-800">
                    {activeSpanModal.isHalfDay
                      ? `0.5 dag (${activeSpanModal.halfDayType})`
                      : activeSpanModal.span % 2 === 0
                      ? `${activeSpanModal.span / 2} ${activeSpanModal.span / 2 === 1 ? 'dag' : 'dagen'}`
                      : `${(activeSpanModal.span / 2).toFixed(1)} dagen`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Functie:</span>
                  <span className="font-semibold text-slate-700">
                    {activeSpanModal.staff.role === 'arts' ? 'Arts' : 'Verpleegkundige'}
                  </span>
                </div>
              </div>

              {/* List of individual days if multiple */}
              {activeSpanModal.requests.length > 1 && (
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {activeSpanModal.requests.map(req => (
                    <div
                      key={req.id}
                      className="p-1.5 bg-slate-50 rounded border border-slate-200/60 flex items-center justify-between text-[11px]"
                    >
                      <span className="font-semibold text-slate-700">{req.date}</span>
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-slate-500">
                          {req.slot === 'HELE_DAG' ? 'Hele dag' : req.slot}
                        </span>
                        {onDirectCancelLeave && (
                          <button
                            type="button"
                            onClick={async () => {
                              if (window.confirm(`Verlof op ${req.date} annuleren?`)) {
                                await onDirectCancelLeave(req.id);
                                setActiveSpanModal(null);
                              }
                            }}
                            className="p-1 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                            title="Annuleer deze dag"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="mt-4 flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              {onDirectCancelLeave && activeSpanModal.requests.length === 1 && (
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Weet u zeker dat u dit verlof wilt annuleren?')) {
                      await onDirectCancelLeave(activeSpanModal.requests[0].id);
                      setActiveSpanModal(null);
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Annuleren</span>
                </button>
              )}

              <div className="flex items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => setActiveSpanModal(null)}
                  className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition cursor-pointer"
                >
                  Sluiten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. COMPACT ADD LEAVE MODAL */}
      {/* ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-sm w-full p-4 animate-scale-in">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-extrabold text-slate-900 text-sm">
                Verlof Inplannen
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveLeave} className="mt-3 space-y-3 text-xs">
              {addError && (
                <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 font-semibold flex items-center gap-1.5 text-[11px]">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-600" />
                  <span>{addError}</span>
                </div>
              )}

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Personeelslid
                </label>
                <select
                  value={addStaffId}
                  onChange={e => {
                    setAddStaffId(e.target.value);
                    const selected = staffList.find(s => s.id === e.target.value);
                    if (selected?.role === 'arts') {
                      setAddType('regulier');
                    }
                  }}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.role === 'arts' ? 'Arts' : 'Verpl.'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Datum
                </label>
                <input
                  type="date"
                  value={addDate}
                  onChange={e => setAddDate(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Dagdeel
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['HELE_DAG', 'VM', 'NM'] as LeaveSlot[]).map(slot => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setAddSlot(slot)}
                      className={`py-1.5 rounded-lg font-bold transition text-xs border ${
                        addSlot === slot
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {slot === 'HELE_DAG' ? 'Hele dag' : slot}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Type
                </label>
                {(() => {
                  const staff = staffList.find(s => s.id === addStaffId);
                  const isDoctor = staff?.role === 'arts';

                  return (
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAddType('regulier')}
                        className={`py-1.5 rounded-lg font-bold transition text-xs border ${
                          addType === 'regulier'
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        Regulier
                      </button>
                      <button
                        type="button"
                        disabled={isDoctor}
                        onClick={() => setAddType('verplicht')}
                        className={`py-1.5 rounded-lg font-bold transition text-xs border ${
                          isDoctor
                            ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
                            : addType === 'verplicht'
                            ? 'bg-amber-600 text-white border-amber-600'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        Verplicht
                      </button>
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  Toelichting (optioneel)
                </label>
                <input
                  type="text"
                  placeholder="Bijv. Opleiding..."
                  value={addNote}
                  onChange={e => setAddNote(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg hover:bg-slate-100 text-slate-600 font-bold transition cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={isSavingLeave}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSavingLeave ? 'Opslaan...' : 'Opslaan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
