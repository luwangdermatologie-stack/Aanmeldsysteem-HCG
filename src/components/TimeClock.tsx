import React, { useState, useEffect } from 'react';
import { ActiveStaff, TimeLog } from '../types';
import { Clock, Plus, Trash2, Edit2, Check, X, Calendar as CalendarIcon, Save } from 'lucide-react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, updateDoc, query, where } from 'firebase/firestore';

interface TimeClockProps {
  staffList: ActiveStaff[];
}

export default function TimeClock({ staffList }: TimeClockProps) {
  const [logs, setLogs] = useState<TimeLog[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<TimeLog>>({});
  
  const [isAddingManually, setIsAddingManually] = useState(false);
  const [newLog, setNewLog] = useState<Partial<TimeLog>>({
    date: new Date().toISOString().split('T')[0],
    staffId: staffList[0]?.id || '',
    morningIn: '',
    morningOut: '',
    afternoonIn: '',
    afternoonOut: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'time_logs'), where('date', '>=', `${selectedMonth}-01`), where('date', '<=', `${selectedMonth}-31`));
    const unsub = onSnapshot(q, (snap) => {
      const data: TimeLog[] = [];
      snap.forEach(doc => {
        data.push(doc.data() as TimeLog);
      });
      data.sort((a, b) => b.date.localeCompare(a.date));
      setLogs(data);
    });
    return () => unsub();
  }, [selectedMonth]);

  const calculateHours = (log: Partial<TimeLog>): number => {
    let total = 0;
    const calcDiff = (inTime?: string, outTime?: string) => {
      if (!inTime || !outTime) return 0;
      const [h1, m1] = inTime.split(':').map(Number);
      const [h2, m2] = outTime.split(':').map(Number);
      return (h2 + m2 / 60) - (h1 + m1 / 60);
    };
    total += calcDiff(log.morningIn, log.morningOut);
    total += calcDiff(log.afternoonIn, log.afternoonOut);
    return Math.max(0, total);
  };

  const handleClockIn = async (staffId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
    
    let existingLog = logs.find(l => l.staffId === staffId && l.date === today);
    if (!existingLog) {
      existingLog = {
        id: `log-${Date.now()}`,
        staffId,
        date: today,
        totalHours: 0
      };
    }
    
    const updated = { ...existingLog };
    if (!updated.morningIn) {
      updated.morningIn = now;
    } else if (!updated.afternoonIn) {
      updated.afternoonIn = now;
    } else {
      alert("U bent vandaag al twee keer ingelogd.");
      return;
    }
    
    updated.totalHours = calculateHours(updated);
    await setDoc(doc(db, 'time_logs', updated.id), updated);
  };

  const handleClockOut = async (staffId: string) => {
    const today = new Date().toISOString().split('T')[0];
    const now = new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
    
    let existingLog = logs.find(l => l.staffId === staffId && l.date === today);
    if (!existingLog) {
      existingLog = {
        id: `log-${Date.now()}`,
        staffId,
        date: today,
        totalHours: 0
      };
    }
    
    const updated = { ...existingLog };
    if (updated.morningIn && !updated.morningOut) {
      updated.morningOut = now;
    } else if (updated.afternoonIn && !updated.afternoonOut) {
      updated.afternoonOut = now;
    } else if (!updated.morningOut) {
      updated.morningOut = now; // Fallback if out clicked before in
    } else if (!updated.afternoonOut) {
      updated.afternoonOut = now;
    } else {
      alert("U bent vandaag al twee keer uitgelogd.");
      return;
    }
    
    updated.totalHours = calculateHours(updated);
    await setDoc(doc(db, 'time_logs', updated.id), updated);
  };

  const saveManualLog = async () => {
    if (!newLog.staffId || !newLog.date) return;
    const id = `log-${Date.now()}`;
    const logToSave = { ...newLog, id, totalHours: calculateHours(newLog) } as TimeLog;
    await setDoc(doc(db, 'time_logs', id), logToSave);
    setIsAddingManually(false);
    setNewLog({
      date: new Date().toISOString().split('T')[0],
      staffId: staffList[0]?.id || '',
      morningIn: '', morningOut: '', afternoonIn: '', afternoonOut: ''
    });
  };

  const startEdit = (log: TimeLog) => {
    setEditingLogId(log.id);
    setEditForm({ ...log });
  };

  const saveEdit = async () => {
    if (!editingLogId) return;
    const totalHours = calculateHours(editForm);
    await updateDoc(doc(db, 'time_logs', editingLogId), { ...editForm, totalHours });
    setEditingLogId(null);
  };

  const deleteLog = async (id: string) => {
    if (confirm('Weet u zeker dat u deze tiktijd wilt verwijderen?')) {
      await deleteDoc(doc(db, 'time_logs', id));
    }
  };

  const getStaffName = (id: string) => staffList.find(s => s.id === id)?.name || 'Onbekend';

  // Group by staff for the summary
  const summaryByStaff = staffList.map(staff => {
    const staffLogs = logs.filter(l => l.staffId === staff.id);
    const total = staffLogs.reduce((acc, l) => acc + (l.totalHours || 0), 0);
    return { staff, total };
  });

  return (
    <div className="space-y-6 animate-fade-in text-sm">
      {/* Live Check-in Panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-500" /> Vandaag Intikken / Uittikken
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {staffList.map(staff => {
            const todayLog = logs.find(l => l.staffId === staff.id && l.date === new Date().toISOString().split('T')[0]);
            return (
              <div key={staff.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-3">
                <div className="font-bold text-slate-700">{staff.name}</div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleClockIn(staff.id)}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-2 rounded-lg transition"
                  >
                    IN
                  </button>
                  <button 
                    onClick={() => handleClockOut(staff.id)}
                    className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2 rounded-lg transition"
                  >
                    UIT
                  </button>
                </div>
                {todayLog && (
                  <div className="text-xs text-slate-500 bg-white p-2 rounded border border-slate-200">
                    <div className="flex justify-between"><span>Ochtend:</span> <span className="font-mono text-slate-700">{todayLog.morningIn || '--:--'} - {todayLog.morningOut || '--:--'}</span></div>
                    <div className="flex justify-between mt-1"><span>Middag:</span> <span className="font-mono text-slate-700">{todayLog.afternoonIn || '--:--'} - {todayLog.afternoonOut || '--:--'}</span></div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-indigo-500" /> Maandrapportage
          </h3>
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={e => setSelectedMonth(e.target.value)}
            className="p-2 text-xs border border-slate-200 rounded-lg"
          />
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {summaryByStaff.map(({staff, total}) => (
            <div key={staff.id} className="p-3 border border-indigo-100 bg-indigo-50/30 rounded-lg">
              <div className="text-xs text-slate-500 font-semibold">{staff.name}</div>
              <div className="text-lg font-bold text-indigo-700">{total.toFixed(2)} uur</div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center mb-3">
          <h4 className="font-semibold text-slate-700">Tiktijden Ljist</h4>
          <button 
            onClick={() => setIsAddingManually(!isAddingManually)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition"
          >
            {isAddingManually ? <X className="h-4 w-4"/> : <Plus className="h-4 w-4" />}
            {isAddingManually ? 'Annuleren' : 'Manueel Toevoegen'}
          </button>
        </div>

        {isAddingManually && (
          <div className="p-4 mb-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-xs items-end">
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Medewerker</label>
              <select value={newLog.staffId} onChange={e => setNewLog({...newLog, staffId: e.target.value})} className="w-full p-2 border rounded">
                {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Datum</label>
              <input type="date" value={newLog.date} onChange={e => setNewLog({...newLog, date: e.target.value})} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">In (Ochtend)</label>
              <input type="time" value={newLog.morningIn || ''} onChange={e => setNewLog({...newLog, morningIn: e.target.value})} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Uit (Ochtend)</label>
              <input type="time" value={newLog.morningOut || ''} onChange={e => setNewLog({...newLog, morningOut: e.target.value})} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">In (Middag)</label>
              <input type="time" value={newLog.afternoonIn || ''} onChange={e => setNewLog({...newLog, afternoonIn: e.target.value})} className="w-full p-2 border rounded" />
            </div>
            <div>
              <label className="block text-slate-500 font-semibold mb-1">Uit (Middag)</label>
              <input type="time" value={newLog.afternoonOut || ''} onChange={e => setNewLog({...newLog, afternoonOut: e.target.value})} className="w-full p-2 border rounded" />
            </div>
            <button onClick={saveManualLog} className="bg-indigo-600 text-white font-bold py-2 rounded flex items-center justify-center gap-1">
              <Save className="h-4 w-4" /> Opslaan
            </button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-semibold">
                <th className="p-3 border-b">Datum</th>
                <th className="p-3 border-b">Medewerker</th>
                <th className="p-3 border-b">Ochtend In/Uit</th>
                <th className="p-3 border-b">Middag In/Uit</th>
                <th className="p-3 border-b">Totaal (Uur)</th>
                <th className="p-3 border-b text-right">Acties</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-slate-400">Geen tiktijden gevonden voor deze maand.</td></tr>
              ) : logs.map(log => {
                if (editingLogId === log.id) {
                  return (
                    <tr key={log.id} className="bg-indigo-50/30">
                      <td className="p-3 border-b"><input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="p-1 border rounded w-full" /></td>
                      <td className="p-3 border-b font-semibold">{getStaffName(log.staffId)}</td>
                      <td className="p-3 border-b flex gap-1">
                        <input type="time" value={editForm.morningIn || ''} onChange={e => setEditForm({...editForm, morningIn: e.target.value})} className="p-1 border rounded w-full" />
                        <input type="time" value={editForm.morningOut || ''} onChange={e => setEditForm({...editForm, morningOut: e.target.value})} className="p-1 border rounded w-full" />
                      </td>
                      <td className="p-3 border-b">
                        <div className="flex gap-1">
                          <input type="time" value={editForm.afternoonIn || ''} onChange={e => setEditForm({...editForm, afternoonIn: e.target.value})} className="p-1 border rounded w-full" />
                          <input type="time" value={editForm.afternoonOut || ''} onChange={e => setEditForm({...editForm, afternoonOut: e.target.value})} className="p-1 border rounded w-full" />
                        </div>
                      </td>
                      <td className="p-3 border-b font-bold text-slate-700">-</td>
                      <td className="p-3 border-b text-right flex justify-end gap-2">
                        <button onClick={saveEdit} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded"><Check className="h-4 w-4"/></button>
                        <button onClick={() => setEditingLogId(null)} className="text-slate-500 hover:bg-slate-100 p-1.5 rounded"><X className="h-4 w-4"/></button>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3 border-b font-mono">{log.date}</td>
                    <td className="p-3 border-b font-semibold text-slate-800">{getStaffName(log.staffId)}</td>
                    <td className="p-3 border-b text-slate-600">{log.morningIn || '-'} / {log.morningOut || '-'}</td>
                    <td className="p-3 border-b text-slate-600">{log.afternoonIn || '-'} / {log.afternoonOut || '-'}</td>
                    <td className="p-3 border-b font-bold text-indigo-600">{log.totalHours?.toFixed(2) || 0}</td>
                    <td className="p-3 border-b text-right flex justify-end gap-2">
                      <button onClick={() => startEdit(log)} className="text-slate-400 hover:text-indigo-600"><Edit2 className="h-4 w-4"/></button>
                      <button onClick={() => deleteLog(log.id)} className="text-slate-400 hover:text-red-500"><Trash2 className="h-4 w-4"/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
