/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { StaffMember, LeaveRequest } from '../../types';
import { Calendar, Briefcase, Sparkles, CalendarDays } from 'lucide-react';
import { formatBelgianDate, isLeaveRequestForStaff } from '../../services/leaveService';

interface CompulsoryLeaveCounterSubmoduleProps {
  staffList: StaffMember[];
  leaveRequests: LeaveRequest[];
}

export const CompulsoryLeaveCounterSubmodule: React.FC<CompulsoryLeaveCounterSubmoduleProps> = ({
  staffList,
  leaveRequests
}) => {
  const currentYearStr = new Date().getFullYear().toString();

  // State for Module 1: Teller Verplicht Verlof (Doorlopend)
  const [compulsoryYear, setCompulsoryYear] = useState<string>('all');

  // State for Module 2: Teller Verlof per Jaar (Verplicht + Regulier in duidelijke cijfers X + Y)
  const [yearlyLeaveYear, setYearlyLeaveYear] = useState<string>(currentYearStr);
  const [yearlyRoleFilter, setYearlyRoleFilter] = useState<'verpleegkundige' | 'arts' | 'all'>('verpleegkundige');

  // Available years from requests
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    set.add(currentYearStr);
    set.add((new Date().getFullYear() + 1).toString());
    leaveRequests.forEach(r => {
      if (r.date && r.date.length >= 4) {
        set.add(r.date.slice(0, 4));
      }
    });
    return Array.from(set).sort().reverse();
  }, [leaveRequests, currentYearStr]);

  // Only nurses for Module 1 (Verplicht Verlof)
  const nurses = useMemo(
    () => staffList.filter(s => s.role === 'verpleegkundige'),
    [staffList]
  );

  // Filtered staff for Module 2 (Verlof per Jaar)
  const yearlyStaff = useMemo(() => {
    return staffList.filter(s => {
      if (yearlyRoleFilter === 'all') return true;
      return s.role === yearlyRoleFilter;
    });
  }, [staffList, yearlyRoleFilter]);

  const formatUnits = (num: number) => {
    const rounded = Math.round(num * 10) / 10;
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1);
  };

  // =========================================================================
  // MODULE 1 DATA: TELLER VERPLICHT VERLOF (DOORLOPEND VOOR VERPLEEGKUNDIGEN)
  // =========================================================================
  const compulsoryStats = useMemo(() => {
    return nurses.map(nurse => {
      const relevantRequests = leaveRequests.filter(r => {
        if (!isLeaveRequestForStaff(r, nurse)) return false;
        if (r.type !== 'verplicht' && r.type !== 'gecompenseerd') return false;
        if (r.status === 'afgekeurd') return false;
        if (compulsoryYear !== 'all' && !r.date.startsWith(compulsoryYear)) return false;
        return true;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let compulsoryDays = 0;
      let compensatedDays = 0;

      relevantRequests.forEach(r => {
        const u = r.units || (r.slot === 'HELE_DAG' ? 1.0 : 0.5);
        if (r.type === 'verplicht') {
          compulsoryDays += u;
        } else if (r.type === 'gecompenseerd') {
          compensatedDays += u;
        }
      });

      const netDays = Math.round((compulsoryDays - compensatedDays) * 10) / 10;
      const netHalfDays = Math.round(netDays * 2);

      return {
        nurse,
        totalDays: netDays,
        totalHalfDays: netHalfDays,
        compulsoryDays: Math.round(compulsoryDays * 10) / 10,
        compensatedDays: Math.round(compensatedDays * 10) / 10,
        history: relevantRequests
      };
    });
  }, [nurses, leaveRequests, compulsoryYear]);

  // =========================================================================
  // MODULE 2 DATA: TELLER VERLOF PER JAAR (VERPLICHT EN REGULIER X + Y)
  // =========================================================================
  const yearlyLeaveStats = useMemo(() => {
    return yearlyStaff.map(staff => {
      // Find all approved or requested leave for this staff in the selected year
      const yearRequests = leaveRequests.filter(r => {
        if (!isLeaveRequestForStaff(r, staff)) return false;
        if (r.status === 'afgekeurd' || r.type === 'feestdag') return false;
        if (!r.date || !r.date.startsWith(yearlyLeaveYear)) return false;
        return r.type === 'verplicht' || r.type === 'regulier';
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      let compulsoryDays = 0;
      let regularDays = 0;

      yearRequests.forEach(r => {
        const u = r.units || (r.slot === 'HELE_DAG' ? 1.0 : 0.5);
        if (r.type === 'verplicht') {
          compulsoryDays += u;
        } else if (r.type === 'regulier') {
          regularDays += u;
        }
      });

      const totalDays = Math.round((compulsoryDays + regularDays) * 10) / 10;

      return {
        staff,
        compulsoryDays: Math.round(compulsoryDays * 10) / 10,
        regularDays: Math.round(regularDays * 10) / 10,
        totalDays,
        history: yearRequests
      };
    });
  }, [yearlyStaff, leaveRequests, yearlyLeaveYear]);

  return (
    <div className="space-y-10">
      {/* ========================================================================= */}
      {/* MODULE 1 (ORIGINEEL): TELLER VERPLICHT VERLOF (DOORLOPEND) */}
      {/* ========================================================================= */}
      <section className="space-y-6">
        {/* Header & Quick Controls */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0 mt-0.5">
              <Sparkles className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-800">
                  Teller Verplicht Verlof (Verpleegkundigen)
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300">
                  Doorlopend
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Gecompenseerde werkdagen (extra gewerkte momenten) worden automatisch in mindering gebracht op deze teller.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Year selector */}
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={compulsoryYear}
                onChange={e => setCompulsoryYear(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer font-bold text-slate-800"
              >
                <option value="all">Doorlopend (Alle jaren)</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    Jaar {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Cards Grid per Nurse */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {compulsoryStats.map(({ nurse, totalDays, compulsoryDays, compensatedDays, history }) => (
            <div
              key={nurse.id}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                    🩺
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-sm">{nurse.name}</h3>
                    <span className="text-[10px] text-slate-500 font-medium">Verpleegkundige</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  Verpleging
                </span>
              </div>

              {/* Single Clear Counter with Netto Calculation */}
              <div className="p-5 bg-white flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Netto Verplicht Verlof Saldo
                </span>
                <div className="text-4xl font-black text-amber-600 flex items-baseline justify-center gap-1">
                  <span>{totalDays > 0 ? `+${formatUnits(totalDays)}` : formatUnits(totalDays)}</span>
                  <span className="text-sm font-bold text-slate-500">d</span>
                </div>

                {/* Sub-breakdown if there are compensated workdays */}
                <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200/80">
                  <span className="text-amber-700">+{formatUnits(compulsoryDays)}d verplicht</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-teal-700">-{formatUnits(compensatedDays)}d gecompenseerd</span>
                </div>
              </div>

              {/* List of Registered Dates & Compensations */}
              <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex-1 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-slate-600">
                    Geregistreerde Momenten ({history.length})
                  </span>
                </div>

                {history.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic text-center py-3">
                    Nog geen verplicht verlof of gecompenseerde werkdagen geregistreerd.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                    {history.map(item => {
                      const isCompensated = item.type === 'gecompenseerd';
                      const isPending = item.status === 'aangevraagd';

                      return (
                        <div
                          key={item.id}
                          className={`p-2 rounded-xl border text-[11px] flex items-center justify-between transition ${
                            isCompensated
                              ? 'bg-teal-50/70 border-teal-200/90 text-teal-950'
                              : 'bg-white border-slate-200 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 font-medium">
                            {isCompensated ? (
                              <Briefcase className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            ) : (
                              <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-slate-800">{formatBelgianDate(item.date)}</span>
                                <span className="text-slate-500 font-semibold">({item.slot})</span>
                                {isPending && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                                    In aanvraag
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-500 block">
                                {isCompensated ? 'Gecompenseerde Werkdag' : 'Verplicht Verlof'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isCompensated ? (
                              <span className="font-bold text-teal-800 text-[10px] bg-teal-100/90 px-2 py-0.5 rounded-full border border-teal-300">
                                -{item.units} dag
                              </span>
                            ) : (
                              <span className="font-bold text-amber-800 text-[10px] bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300">
                                +{item.units} dag
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ========================================================================= */}
      {/* MODULE 2 (NIEUWE MODULE DAARONDER): TELLER VERLOF PER JAAR (X + Y) */}
      {/* ========================================================================= */}
      <section className="space-y-6 pt-4 border-t-2 border-slate-200/80">
        {/* Header & Controls voor Verlof per Jaar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-800 flex items-center justify-center font-bold shrink-0 mt-0.5">
              <CalendarDays className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-slate-800">
                  Teller Verlof per Jaar
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-900 border border-indigo-300">
                  Jaar {yearlyLeaveYear}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Overzicht van het opgenomen verlof per jaar, weergegeven in duidelijke cijfers <strong>X verplicht + Y regulier</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
            {/* Role Filter */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setYearlyRoleFilter('verpleegkundige')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  yearlyRoleFilter === 'verpleegkundige'
                    ? 'bg-white text-emerald-800 font-extrabold shadow-2xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Verpleegkundigen
              </button>
              <button
                type="button"
                onClick={() => setYearlyRoleFilter('arts')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  yearlyRoleFilter === 'arts'
                    ? 'bg-white text-blue-800 font-extrabold shadow-2xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Artsen
              </button>
              <button
                type="button"
                onClick={() => setYearlyRoleFilter('all')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  yearlyRoleFilter === 'all'
                    ? 'bg-white text-slate-900 font-extrabold shadow-2xs'
                    : 'hover:text-slate-900'
                }`}
              >
                Alles
              </button>
            </div>

            {/* Year selector */}
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] text-slate-400 font-semibold">Jaar:</span>
              <select
                value={yearlyLeaveYear}
                onChange={e => setYearlyLeaveYear(e.target.value)}
                className="bg-transparent focus:outline-none cursor-pointer font-black text-indigo-900"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    Jaar {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Cards Grid per Staff Member for Annual Leave */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {yearlyLeaveStats.map(({ staff, compulsoryDays, regularDays, totalDays, history }) => {
            const isNurse = staff.role === 'verpleegkundige';

            return (
              <div
                key={staff.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden"
              >
                {/* Header */}
                <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                        isNurse ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {isNurse ? '🩺' : '👨‍⚕️'}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-slate-800 text-sm">{staff.name}</h3>
                      <span className="text-[10px] text-slate-500 font-medium capitalize">
                        {isNurse ? 'Verpleegkundige' : 'Arts'}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                      isNurse
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : 'bg-blue-50 text-blue-800 border-blue-200'
                    }`}
                  >
                    {isNurse ? 'Verpleging' : 'Arts'}
                  </span>
                </div>

                {/* Duidelijke Cijfer X + Y Box */}
                <div className="p-5 bg-white space-y-4">
                  {/* Totaal in Jaar */}
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                      Totaal Verlof in {yearlyLeaveYear}
                    </span>
                    <span className="text-xs font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      {formatUnits(totalDays)} dagen
                    </span>
                  </div>

                  {/* Formuleblok met duidelijke cijfers X + Y */}
                  <div className="grid grid-cols-5 items-center gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/90 text-center shadow-2xs">
                    {/* Cijfer X: Verplicht */}
                    <div className="col-span-2 p-2 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-[10px] uppercase font-black text-amber-800 block">
                        Verplicht (X)
                      </span>
                      <div className="text-2xl font-black text-amber-900 leading-tight mt-0.5">
                        {formatUnits(compulsoryDays)}<span className="text-xs font-bold text-amber-700">d</span>
                      </div>
                    </div>

                    {/* Plus Icon */}
                    <div className="text-xl font-black text-slate-400 select-none">
                      +
                    </div>

                    {/* Cijfer Y: Regulier */}
                    <div className="col-span-2 p-2 bg-indigo-50 rounded-xl border border-indigo-200">
                      <span className="text-[10px] uppercase font-black text-indigo-800 block">
                        Regulier (Y)
                      </span>
                      <div className="text-2xl font-black text-indigo-900 leading-tight mt-0.5">
                        {formatUnits(regularDays)}<span className="text-xs font-bold text-indigo-700">d</span>
                      </div>
                    </div>
                  </div>

                  {/* Uitschrijving van de optelling */}
                  <div className="bg-slate-50/80 py-2 px-3 rounded-xl border border-slate-200 text-center">
                    <p className="text-xs font-extrabold text-slate-800 tracking-tight">
                      <span className="text-amber-800 font-black text-sm">{formatUnits(compulsoryDays)}</span>
                      <span className="text-slate-500 font-medium text-[11px]"> verplicht </span>
                      <span className="text-slate-400 font-black">+ </span>
                      <span className="text-indigo-800 font-black text-sm">{formatUnits(regularDays)}</span>
                      <span className="text-slate-500 font-medium text-[11px]"> regulier </span>
                      <span className="text-slate-400 font-black">= </span>
                      <span className="text-emerald-700 font-black text-sm">{formatUnits(totalDays)} dagen</span>
                    </p>
                  </div>
                </div>

                {/* Detail van opgenomen dagen in dit jaar */}
                <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex-1 flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold text-slate-600">
                      Opgenomen Verlofdagen in {yearlyLeaveYear} ({history.length})
                    </span>
                  </div>

                  {history.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic text-center py-3">
                      Geen verlofdagen geregistreerd in {yearlyLeaveYear}.
                    </p>
                  ) : (
                    <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                      {history.map(item => {
                        const isCompulsory = item.type === 'verplicht';
                        const isPending = item.status === 'aangevraagd';

                        return (
                          <div
                            key={item.id}
                            className={`p-2 rounded-xl border text-[11px] flex items-center justify-between transition ${
                              isCompulsory
                                ? 'bg-amber-50/60 border-amber-200/90 text-amber-950'
                                : 'bg-indigo-50/50 border-indigo-200/80 text-indigo-950'
                            }`}
                          >
                            <div className="flex items-center gap-2 font-medium">
                              {isCompulsory ? (
                                <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                              ) : (
                                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              )}
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-slate-800">{formatBelgianDate(item.date)}</span>
                                  <span className="text-slate-500 font-semibold">({item.slot === 'HELE_DAG' ? 'Hele dag' : item.slot})</span>
                                  {isPending && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold">
                                      In aanvraag
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-slate-500 block">
                                  {isCompulsory ? 'Verplicht Verlof' : 'Regulier Verlof'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {isCompulsory ? (
                                <span className="font-bold text-amber-800 text-[10px] bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300">
                                  +{item.units}d (X)
                                </span>
                              ) : (
                                <span className="font-bold text-indigo-800 text-[10px] bg-indigo-100/90 px-2 py-0.5 rounded-full border border-indigo-300">
                                  +{item.units}d (Y)
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
