/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { StaffMember, LeaveRequest } from '../../types';
import { Calendar } from 'lucide-react';

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

  // Calculate simplified totals per nurse
  const nurseStats = useMemo(() => {
    return nurses.map(nurse => {
      // Find all compulsory leave for this nurse (excluding rejected)
      const compulsoryRequests = leaveRequests.filter(r => {
        if (r.staff_id !== nurse.id || r.type !== 'verplicht' || r.status === 'afgekeurd') {
          return false;
        }
        if (selectedYear !== 'all' && !r.date.startsWith(selectedYear)) {
          return false;
        }
        return true;
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      const totalDays = compulsoryRequests.reduce((acc, curr) => acc + (curr.units || 0.5), 0);
      const totalHalfDays = Math.round(totalDays * 2);

      return {
        nurse,
        totalDays,
        totalHalfDays,
        history: compulsoryRequests
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
        {nurseStats.map(({ nurse, totalDays, history }) => (
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
                </div>
              </div>
            </div>

            {/* Single Clear Counter */}
            <div className="p-5 bg-white flex flex-col items-center justify-center text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Verplicht Verlof
              </span>
              <div className="text-4xl font-black text-amber-600 flex items-baseline justify-center gap-1">
                <span>{totalDays}</span>
                <span className="text-sm font-bold text-slate-500">d</span>
              </div>
            </div>

            {/* List of Registered Dates */}
            <div className="p-3.5 bg-slate-50/80 border-t border-slate-100 flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-600">
                  Opgenomen Momenten ({history.length})
                </span>
              </div>

              {history.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic text-center py-2">
                  Nog geen verplicht verlof geregistreerd.
                </p>
              ) : (
                <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                  {history.map(item => (
                    <div
                      key={item.id}
                      className="p-1.5 rounded-lg bg-white border border-slate-200 text-[11px] flex items-center justify-between"
                    >
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        <Calendar className="w-3 h-3 text-amber-600" />
                        <span>{item.date}</span>
                        <span className="text-slate-400">({item.slot})</span>
                      </div>
                      <span className="font-bold text-amber-800 text-[10px] bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                        +{item.units} dag
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
