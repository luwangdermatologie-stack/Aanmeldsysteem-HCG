/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { StaffMember, LeaveRequest } from '../../types';
import { Calendar, Briefcase, TrendingDown, Sparkles } from 'lucide-react';
import { formatBelgianDate } from '../../services/leaveService';

interface CompulsoryLeaveCounterSubmoduleProps {
  staffList: StaffMember[];
  leaveRequests: LeaveRequest[];
}

export const CompulsoryLeaveCounterSubmodule: React.FC<CompulsoryLeaveCounterSubmoduleProps> = ({
  staffList,
  leaveRequests
}) => {
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  // Filter only nurses
  const nurses = useMemo(
    () => staffList.filter(s => s.role === 'verpleegkundige'),
    [staffList]
  );

  // Available years from requests
  const availableYears = useMemo(() => {
    const set = new Set<string>();
    set.add(new Date().getFullYear().toString());
    leaveRequests.forEach(r => {
      if (r.date) {
        set.add(r.date.slice(0, 4));
      }
    });
    return Array.from(set).sort().reverse();
  }, [leaveRequests]);

  // Calculate totals per nurse (Verplicht Verlof minus Gecompenseerde Werkdagen)
  const nurseStats = useMemo(() => {
    return nurses.map(nurse => {
      // Find all compulsory leave & compensated workdays for this nurse (excluding rejected)
      const relevantRequests = leaveRequests.filter(r => {
        if (r.staff_id !== nurse.id || (r.type !== 'verplicht' && r.type !== 'gecompenseerd') || r.status === 'afgekeurd') {
          return false;
        }
        if (selectedYear !== 'all' && !r.date.startsWith(selectedYear)) {
          return false;
        }
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
        compulsoryDays,
        compensatedDays,
        history: relevantRequests
      };
    });
  }, [nurses, leaveRequests, selectedYear]);

  return (
    <div className="space-y-6">
      {/* 1. Header & Quick Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-800">
            Teller Verplicht Verlof (Verpleegkundigen)
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Gecompenseerde werkdagen (extra gewerkte momenten) worden automatisch in mindering gebracht op deze teller.
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Year selector */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700">
            <Calendar className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              className="bg-transparent focus:outline-none cursor-pointer"
            >
              <option value="all">Alle Jaren</option>
              {availableYears.map(y => (
                <option key={y} value={y}>
                  Jaar {y}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 2. Cards Grid per Nurse */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nurseStats.map(({ nurse, totalDays, compulsoryDays, compensatedDays, history }) => (
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
            </div>

            {/* Single Clear Counter with Netto Calculation */}
            <div className="p-5 bg-white flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Netto Verplicht Verlof Saldo
              </span>
              <div className="text-4xl font-black text-amber-600 flex items-baseline justify-center gap-1">
                <span>{totalDays}</span>
                <span className="text-sm font-bold text-slate-500">d</span>
              </div>
              
              {/* Sub-breakdown if there are compensated workdays */}
              <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-slate-600 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-200/80">
                <span className="text-amber-700">+{compulsoryDays}d verplicht</span>
                <span className="text-slate-300">•</span>
                <span className="text-teal-700">-{compensatedDays}d gecompenseerd</span>
              </div>
            </div>

            {/* List of Registered Dates & Compensations */}
            <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-600">
                  Geregistreerde Momenten ({history.length})
                </span>
              </div>

              {history.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic text-center py-2">
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

                        <div>
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
    </div>
  );
};
