/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import {
  StaffMember,
  LeaveRequest,
  GeneralComment,
  TodoItem,
  LeaveSlot,
  LeaveType,
  DayOfWeekKey,
  WeeklySchedule
} from '../../types';
import {
  DAYS_OF_WEEK,
  getISOWeekDetails,
  createDefaultSchedule
} from '../../services/leaveService';
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Archive,
  RotateCcw,
  MessageSquare,
  ListTodo,
  ShieldCheck,
  Check,
  AlertTriangle,
  X,
  Sparkles,
  ArrowRightLeft,
  CalendarDays,
  RefreshCw
} from 'lucide-react';

interface WeekOverviewSubmoduleProps {
  staffList: StaffMember[];
  leaveRequests: LeaveRequest[];
  comments: GeneralComment[];
  todos: TodoItem[];
  shiftOverrides?: Record<string, 'dienst' | 'vrij'>;
  onAddComment: (comment: Omit<GeneralComment, 'id' | 'created_at'>) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onAddTodo: (todo: Omit<TodoItem, 'id' | 'created_at'>) => Promise<void>;
  onToggleTodo: (todoId: string, currentCompleted: boolean) => Promise<void>;
  onDeleteTodo: (todoId: string) => Promise<void>;
  onRestoreTodo?: (todoId: string) => Promise<void>;
  onDirectSetLeave: (staffId: string, staffName: string, date: string, slot: LeaveSlot, type: LeaveType) => Promise<void>;
  onDirectCancelLeave: (requestId: string) => Promise<void>;
  onDirectSwitchLeaveType?: (requestId: string, newType: LeaveType) => Promise<void>;
  onDirectSetShiftStatus?: (staffId: string, date: string, slot: 'VM' | 'NM', status: 'dienst' | 'vrij') => Promise<void>;
  onUpdateStaffSchedule?: (staffId: string, newSchedule: WeeklySchedule) => Promise<void>;
}

export const WeekOverviewSubmodule: React.FC<WeekOverviewSubmoduleProps> = ({
  staffList,
  leaveRequests,
  comments,
  todos,
  shiftOverrides = {},
  onAddComment,
  onDeleteComment,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onRestoreTodo,
  onDirectSetLeave,
  onDirectCancelLeave,
  onDirectSwitchLeaveType,
  onDirectSetShiftStatus,
  onUpdateStaffSchedule
}) => {
  // Current view date anchored on selected week
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [showArchive, setShowArchive] = useState(false);

  // Form states for Comment
  const [commentAuthorId, setCommentAuthorId] = useState<string>(staffList[0]?.id || '');
  const [commentText, setCommentText] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Keep commentAuthorId aligned if staffList loads or changes
  React.useEffect(() => {
    if (staffList.length > 0) {
      if (!commentAuthorId || !staffList.some(s => s.id === commentAuthorId)) {
        setCommentAuthorId(staffList[0].id);
      }
    }
  }, [staffList, commentAuthorId]);

  // Form states for Todo
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDeadline, setTodoDeadline] = useState('');
  const [isSubmittingTodo, setIsSubmittingTodo] = useState(false);

  // Quick Action Modal for Direct Leave setting in the roster
  const [activeQuickSlot, setActiveQuickSlot] = useState<{
    staff: StaffMember;
    dateStr: string;
    dayKey: DayOfWeekKey;
    dayLabel: string;
    formattedDate: string;
    slot: 'VM' | 'NM';
    currentLeave?: LeaveRequest;
    rawLeaveRequest?: LeaveRequest;
    isScheduled: boolean;
    isOverridden?: boolean;
  } | null>(null);

  // Calculate week details
  const weekInfo = useMemo(() => getISOWeekDetails(currentDate), [currentDate]);

  // Navigate weeks
  const goToPreviousWeek = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 7);
    setCurrentDate(prev);
  };

  const goToNextWeek = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 7);
    setCurrentDate(next);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const handleDatePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const [y, m, d] = e.target.value.split('-').map(Number);
      setCurrentDate(new Date(y, m - 1, d));
    }
  };

  // Filter comments for current week
  const currentWeekComments = useMemo(() => {
    return comments
      .filter(c => c.week_identifier === weekInfo.identifier)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [comments, weekInfo.identifier]);

  // Active vs Archived todos
  const activeTodos = useMemo(() => todos.filter(t => !t.archived && !t.is_completed), [todos]);
  const archivedTodos = useMemo(() => todos.filter(t => t.archived || t.is_completed), [todos]);

  // Separate staff into doctors and nurses
  const doctors = useMemo(() => staffList.filter(s => s.role === 'arts'), [staffList]);
  const nurses = useMemo(() => staffList.filter(s => s.role === 'verpleegkundige'), [staffList]);

  // Submit comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || !commentAuthorId) return;

    setCommentText('');
    setIsSubmittingComment(true);
    try {
      const author = staffList.find(s => s.id === commentAuthorId);
      await onAddComment({
        week_identifier: weekInfo.identifier,
        author_id: commentAuthorId,
        author_name: author?.name || 'Medewerker',
        message: text
      });
    } catch (err) {
      console.error('Fout bij plaatsen opmerking:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Submit Todo
  const handlePostTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = todoTitle.trim();
    const deadline = todoDeadline || undefined;
    if (!title) return;

    setTodoTitle('');
    setTodoDeadline('');
    setIsSubmittingTodo(true);
    try {
      await onAddTodo({
        title,
        deadline,
        is_completed: false,
        archived: false
      });
    } catch (err) {
      console.error('Fout bij toevoegen taak:', err);
    } finally {
      setIsSubmittingTodo(false);
    }
  };

  // Check slot status for a staff member on a specific day
  const getSlotStatus = (staff: StaffMember, dayKey: DayOfWeekKey, dateStr: string, slot: 'vm' | 'nm') => {
    const overrideKey = `${staff.id}_${dateStr}_${slot}`;
    const hasOverride = Boolean(shiftOverrides && shiftOverrides[overrideKey] !== undefined);
    const isScheduled = hasOverride
      ? shiftOverrides[overrideKey] === 'dienst'
      : (staff.schedule?.[dayKey]?.[slot] ?? false);

    // Check for active leave request on this date
    const req = leaveRequests.find(r => {
      if (r.staff_id !== staff.id || r.date !== dateStr) return false;
      if (r.status === 'afgekeurd') return false; // Rejected leave does not count
      const rSlot = (r.slot || '').toUpperCase();
      if (rSlot === 'HELE_DAG') return true;
      if (slot.toUpperCase() === rSlot) return true;
      return false;
    });

    // Direct synchronization with fixed schedule:
    // If not scheduled (e.g. employee has a fixed free day/half-day), they are already free
    const effectiveLeaveRequest = isScheduled ? req : undefined;

    return {
      isScheduled,
      leaveRequest: effectiveLeaveRequest,
      rawLeaveRequest: req,
      isOverridden: hasOverride
    };
  };

  // =========================================================================
  // RATIO CHECK: 1 VERPLEEGKUNDIGE VOOR 1 ARTS
  // "Als er op een bepaalde halve dag meer artsen zijn dan verpleegkundige dan
  // zou ik graag hebben dat de datum bovenaan, het vakje in het rood komt te staan."
  // =========================================================================
  const slotStaffingStats = useMemo(() => {
    const stats: Record<string, {
      vm: { doctors: number; nurses: number; isShortage: boolean };
      nm: { doctors: number; nurses: number; isShortage: boolean };
      dayHasShortage: boolean;
    }> = {};

    weekInfo.days.forEach(d => {
      // Calculate VM
      let vmDocs = 0;
      doctors.forEach(doc => {
        const status = getSlotStatus(doc, d.dayKey, d.dateStr, 'vm');
        if (status.isScheduled && !status.leaveRequest) {
          vmDocs++;
        }
      });
      let vmNurses = 0;
      nurses.forEach(nurse => {
        const status = getSlotStatus(nurse, d.dayKey, d.dateStr, 'vm');
        if (status.isScheduled && !status.leaveRequest) {
          vmNurses++;
        }
      });
      const vmShortage = vmDocs > vmNurses;

      // Calculate NM
      let nmDocs = 0;
      doctors.forEach(doc => {
        const status = getSlotStatus(doc, d.dayKey, d.dateStr, 'nm');
        if (status.isScheduled && !status.leaveRequest) {
          nmDocs++;
        }
      });
      let nmNurses = 0;
      nurses.forEach(nurse => {
        const status = getSlotStatus(nurse, d.dayKey, d.dateStr, 'nm');
        if (status.isScheduled && !status.leaveRequest) {
          nmNurses++;
        }
      });
      const nmShortage = nmDocs > nmNurses;

      stats[d.dateStr] = {
        vm: { doctors: vmDocs, nurses: vmNurses, isShortage: vmShortage },
        nm: { doctors: nmDocs, nurses: nmNurses, isShortage: nmShortage },
        dayHasShortage: vmShortage || nmShortage
      };
    });

    return stats;
  }, [weekInfo.days, doctors, nurses, leaveRequests, shiftOverrides]);

  // Direct set leave handler from quick modal: INSTANT MODAL CLOSE
  const handleApplyDirectLeave = (type: LeaveType, slotOverride?: LeaveSlot) => {
    if (!activeQuickSlot) return;
    const target = activeQuickSlot;
    // 1. Instantly close modal synchronously
    setActiveQuickSlot(null);
    // 2. Fire leave update optimistically
    onDirectSetLeave(
      target.staff.id,
      target.staff.name,
      target.dateStr,
      slotOverride || target.slot,
      type
    ).catch(err => console.warn('Direct leave action error:', err));
  };

  // Direct cancel leave (reset to Dienst): INSTANT MODAL CLOSE
  const handleApplyCancelLeave = () => {
    if (!activeQuickSlot) return;
    const target = activeQuickSlot;
    // 1. Instantly close modal synchronously
    setActiveQuickSlot(null);
    // 2. Perform removal/reset
    if (target.currentLeave?.id) {
      onDirectCancelLeave(target.currentLeave.id).catch(err => console.warn('Cancel leave action error:', err));
    } else if (onDirectSetShiftStatus) {
      onDirectSetShiftStatus(target.staff.id, target.dateStr, target.slot, 'dienst').catch(err => console.warn('Set shift status error:', err));
    }
  };

  // Switch leave type if already on leave: INSTANT MODAL CLOSE
  const handleApplySwitchType = (newType: LeaveType) => {
    if (!activeQuickSlot?.currentLeave) return;
    const target = activeQuickSlot;
    // 1. Instantly close modal synchronously
    setActiveQuickSlot(null);
    if (onDirectSwitchLeaveType) {
      onDirectSwitchLeaveType(target.currentLeave.id, newType).catch(err => console.warn('Switch leave type error:', err));
    } else {
      onDirectCancelLeave(target.currentLeave.id)
        .then(() => onDirectSetLeave(target.staff.id, target.staff.name, target.dateStr, target.slot, newType))
        .catch(err => console.warn('Switch leave type fallback error:', err));
    }
  };

  // Set shift directly to Dienst or Vrij: INSTANT MODAL CLOSE
  const handleApplySetShiftStatus = (status: 'dienst' | 'vrij', wholeDay = false) => {
    if (!activeQuickSlot) return;
    const target = activeQuickSlot;
    // 1. Instantly close modal synchronously
    setActiveQuickSlot(null);
    if (target.currentLeave?.id) {
      onDirectCancelLeave(target.currentLeave.id).catch(err => console.warn('Cancel leave error:', err));
    }
    if (onDirectSetShiftStatus) {
      if (wholeDay) {
        onDirectSetShiftStatus(target.staff.id, target.dateStr, 'VM', status).catch(err => console.warn('Set VM error:', err));
        onDirectSetShiftStatus(target.staff.id, target.dateStr, 'NM', status).catch(err => console.warn('Set NM error:', err));
      } else {
        onDirectSetShiftStatus(target.staff.id, target.dateStr, target.slot, status).catch(err => console.warn('Set shift status error:', err));
      }
    }
  };

  // Permanently update fixed schedule directly from Weekoverzicht (Direct Synchronization)
  const handleApplyPermanentFixedSchedule = async (newActiveState: boolean) => {
    if (!activeQuickSlot || !onUpdateStaffSchedule) return;
    const target = activeQuickSlot;
    setActiveQuickSlot(null);

    const currentSched = target.staff.schedule || createDefaultSchedule();
    const slotKey = target.slot.toLowerCase() as 'vm' | 'nm';
    const updatedSchedule: WeeklySchedule = {
      ...currentSched,
      [target.dayKey]: {
        ...(currentSched[target.dayKey] || { vm: false, nm: false }),
        [slotKey]: newActiveState
      }
    };

    try {
      await onUpdateStaffSchedule(target.staff.id, updatedSchedule);
    } catch (err) {
      console.error('Fout bij synchroniseren van vast werkschema:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP SECTION: ALGEMENE OPMERKINGEN & TO DO LIJST STRIKT NAAST ELKAAR */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* LINKERHELFT: ALGEMENE OPMERKINGEN */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                <MessageSquare className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-xs">Algemene Opmerkingen</h3>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
              {currentWeekComments.length} opmerking{currentWeekComments.length === 1 ? '' : 'en'}
            </span>
          </div>

          {/* Feed */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {currentWeekComments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <MessageSquare className="w-7 h-7 stroke-1 text-slate-300 mb-1.5" />
                <p className="text-xs font-medium">Nog geen opmerkingen voor {weekInfo.identifier}.</p>
                <p className="text-[10px] text-slate-400">Plaats hieronder een mededeling voor het team.</p>
              </div>
            ) : (
              currentWeekComments.map(comment => {
                const author = staffList.find(s => s.id === comment.author_id);
                const roleBadge = author?.role === 'arts' ? 'Arts' : 'Verpleegkundige';
                const roleColor = author?.role === 'arts' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                const timeStr = new Date(comment.created_at).toLocaleDateString('nl-BE', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div key={comment.id} className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/70 hover:bg-slate-50 transition group">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-xs text-slate-800">
                          {comment.author_name || author?.name || 'Onbekend'}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.2 rounded border font-semibold ${roleColor}`}>
                          {roleBadge}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] text-slate-400">{timeStr}</span>
                        <button
                          type="button"
                          onClick={() => onDeleteComment(comment.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition p-0.5 cursor-pointer"
                          title="Opmerking verwijderen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {comment.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* New Comment Form - Spacious 2-row layout */}
          <form onSubmit={handlePostComment} className="p-3 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl space-y-2 shrink-0">
            <input
              type="text"
              placeholder="Typ een opmerking voor deze week..."
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
              required
            />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs min-w-0 flex-1">
                <span className="text-[11px] font-bold text-slate-500 shrink-0">Auteur:</span>
                <select
                  value={commentAuthorId}
                  onChange={e => setCommentAuthorId(e.target.value)}
                  className="w-full text-xs bg-transparent border-0 font-medium text-slate-700 focus:outline-none focus:ring-0 truncate cursor-pointer py-0"
                  required
                >
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.role === 'arts' ? '👨‍⚕️' : '🩺'} {s.name} ({s.role === 'arts' ? 'Arts' : 'Verpl.'})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={isSubmittingComment || !commentText.trim()}
                className="h-8 px-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Plaatsen</span>
              </button>
            </div>
          </form>
        </div>

        {/* RECHTERHELFT: TO DO LIJST COÖRDINATOR */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[400px]">
          <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 rounded-t-2xl shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600">
                <ListTodo className="w-3.5 h-3.5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800 text-xs">To Do Lijst Coördinator</h3>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowArchive(!showArchive)}
              className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border cursor-pointer ${
                showArchive
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Archive className="w-3 h-3" />
              {showArchive ? 'Actief' : `Archief (${archivedTodos.length})`}
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
            {!showArchive ? (
              activeTodos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                  <CheckCircle2 className="w-7 h-7 stroke-1 text-emerald-400 mb-1.5" />
                  <p className="text-xs font-semibold text-slate-700">Geen openstaande taken!</p>
                  <p className="text-[10px] text-slate-400">Alle verlof- en planningszaken zijn afgehandeld.</p>
                </div>
              ) : (
                activeTodos.map(todo => {
                  const hasDeadline = !!todo.deadline;
                  const isOverdue = hasDeadline && new Date(todo.deadline!).getTime() < Date.now() - 86400000;

                  return (
                    <div
                      key={todo.id}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-xs transition flex items-start justify-between gap-2.5 group"
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => onToggleTodo(todo.id, false)}
                          className="w-4.5 h-4.5 rounded border border-slate-300 hover:border-teal-600 hover:bg-teal-50 flex items-center justify-center transition cursor-pointer shrink-0 text-white hover:text-teal-600 mt-0.5"
                          title="Afvinken en archiveren"
                        >
                          <Check className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-800 break-words whitespace-normal leading-snug">{todo.title}</p>
                          {hasDeadline && (
                            <span
                              className={`text-[9px] font-medium flex items-center gap-1 mt-1 ${
                                isOverdue ? 'text-red-600 font-bold' : 'text-slate-400'
                              }`}
                            >
                              <Clock className="w-2.5 h-2.5 shrink-0" />
                              Deadline: {todo.deadline} {isOverdue && '(Verstreken!)'}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDeleteTodo(todo.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition p-0.5 cursor-pointer shrink-0 mt-0.5"
                        title="Verwijderen"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              )
            ) : (
              /* Archive */
              archivedTodos.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                  <Archive className="w-7 h-7 stroke-1 text-slate-300 mb-1.5" />
                  <p className="text-xs font-medium">Het archief is leeg.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-semibold px-1">
                    <span>Afgeronde Taken</span>
                    <span>{archivedTodos.length} items</span>
                  </div>
                  {archivedTodos.map(todo => (
                    <div
                      key={todo.id}
                      className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-2 opacity-85"
                    >
                      <div className="flex items-start gap-2 min-w-0 flex-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        <span className="text-xs text-slate-600 line-through break-words whitespace-normal leading-snug">{todo.title}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {onRestoreTodo && (
                          <button
                            type="button"
                            onClick={() => onRestoreTodo(todo.id)}
                            className="px-1.5 py-0.5 text-[9px] font-bold rounded bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 flex items-center gap-1 transition cursor-pointer"
                            title="Herstellen"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            Herstel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDeleteTodo(todo.id)}
                          className="text-slate-400 hover:text-red-600 transition p-0.5 cursor-pointer"
                          title="Wissen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Add Todo Form - Spacious 2-row layout */}
          {!showArchive && (
            <form onSubmit={handlePostTodo} className="p-3 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl space-y-2 shrink-0">
              <input
                type="text"
                placeholder="Nieuwe taak voor de verlofcoördinator..."
                value={todoTitle}
                onChange={e => setTodoTitle(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500 shadow-2xs"
                required
              />
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 shadow-2xs min-w-0 flex-1">
                  <span className="text-[11px] font-bold text-slate-500 shrink-0">Datum:</span>
                  <input
                    type="date"
                    value={todoDeadline}
                    onChange={e => setTodoDeadline(e.target.value)}
                    className="w-full text-xs bg-transparent border-0 text-slate-700 font-medium focus:outline-none focus:ring-0 cursor-pointer py-0"
                    title="Optionele deadline"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmittingTodo || !todoTitle.trim()}
                  className="h-8 px-3.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Toevoegen</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. WEEKROOSTER NAVIGATIEBALK */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={goToPreviousWeek}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition cursor-pointer"
              title="Vorige week"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={goToToday}
              className="px-3 py-1 text-xs font-bold text-slate-700 hover:bg-white rounded-lg transition cursor-pointer"
            >
              Vandaag
            </button>
            <button
              type="button"
              onClick={goToNextWeek}
              className="p-1.5 hover:bg-white rounded-lg text-slate-700 transition cursor-pointer"
              title="Volgende week"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span className="font-extrabold text-slate-800 text-base tracking-tight">
              Week {weekInfo.weekNumber} <span className="text-slate-500 font-normal text-sm">({weekInfo.formattedRange})</span>
            </span>
          </div>
        </div>

        {/* Ratio Rule Explanation Badge & Datepicker Jump */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Vaste schema's <strong>gesynchroniseerd</strong> met weekrooster</span>
          </div>

          <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
            <span>Bezetting: Minimaal <strong>1 verpleegkundige per arts</strong> per dagdeel</span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <label className="text-slate-500 font-bold">Datum:</label>
            <input
              type="date"
              value={currentDate.toISOString().slice(0, 10)}
              onChange={handleDatePick}
              className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. HET WEEKROOSTER MET DIRECT VERLOF INSTELLEN & RATIO ALERTS (ROOD) */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Table Legend */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="font-bold text-slate-700 text-xs">Legende:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300"></span>
              <span className="text-slate-600 text-[11px]">Dienst (Aanwezig)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-indigo-50 border-2 border-dashed border-indigo-400"></span>
              <span className="text-slate-600 text-[11px]">Verlof (In Aanvraag)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-400"></span>
              <span className="text-slate-600 text-[11px]">Verlof (Goedgekeurd)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-50 border-2 border-dashed border-amber-400"></span>
              <span className="text-slate-600 text-[11px]">Verplicht (In Aanvraag)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-100 border border-amber-400"></span>
              <span className="text-slate-600 text-[11px]">Verplicht (Goedgekeurd)</span>
            </div>
          </div>
        </div>

        {/* Matrix */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[760px] md:min-w-full">
            <thead>
              {/* Top Row: Days with Ratio check (Red header if shortage) */}
              <tr className="border-b border-slate-200 text-xs font-bold text-slate-700">
                <th className="p-2.5 w-[130px] min-w-[120px] max-w-[135px] bg-slate-200/60 sticky left-0 z-20">
                  Personeelslid
                </th>
                {weekInfo.days.map(d => {
                  const dayStat = slotStaffingStats[d.dateStr];
                  const hasShortage = dayStat?.dayHasShortage ?? false;

                  return (
                    <th
                      key={d.dateStr}
                      colSpan={2}
                      className={`p-2.5 text-center border-l transition-colors ${
                        hasShortage
                          ? 'bg-red-600 text-white border-red-700 shadow-inner'
                          : 'bg-slate-100/90 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {hasShortage && (
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                        )}
                        <span className={`font-black text-xs ${hasShortage ? 'text-white' : 'text-slate-800'}`}>
                          {d.label}
                        </span>
                      </div>
                      <div className={`text-[11px] font-normal ${hasShortage ? 'text-red-100 font-semibold' : 'text-slate-500'}`}>
                        {d.formattedDate}
                      </div>
                      {hasShortage && (
                        <div className="mt-1 inline-block px-2 py-0.5 bg-red-800/90 text-white rounded-md text-[10px] font-black tracking-tight">
                          TEKORT VERPLEGING
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>

              {/* Second Row: VM / NM Sub-headers with Ratio status in RED if slot deficient */}
              <tr className="border-b border-slate-200 text-[10px] font-bold text-center uppercase tracking-wider">
                <th className="p-1.5 w-[130px] min-w-[120px] max-w-[135px] sticky left-0 z-20 bg-slate-100 border-r border-slate-200 text-slate-600">
                  Dagdeel
                </th>
                {weekInfo.days.map(d => {
                  const dayStat = slotStaffingStats[d.dateStr];
                  const vmShortage = dayStat?.vm.isShortage;
                  const nmShortage = dayStat?.nm.isShortage;

                  return (
                    <React.Fragment key={`sub-${d.dateStr}`}>
                      {/* VM Header */}
                      <th
                        className={`p-1.5 border-l w-[60px] transition-colors ${
                          vmShortage
                            ? 'bg-red-500 text-white font-black border-red-600'
                            : 'bg-slate-50/90 text-slate-600 border-slate-200'
                        }`}
                        title={
                          vmShortage
                            ? `⚠️ TEKORT: ${dayStat?.vm.doctors} artsen vs ${dayStat?.vm.nurses} verpleegkundigen!`
                            : `VM bezetting: ${dayStat?.vm.doctors} artsen en ${dayStat?.vm.nurses} verpleegkundigen`
                        }
                      >
                        VM
                        {vmShortage && (
                          <span className="block text-[8px] leading-none font-bold text-yellow-200 mt-0.5">
                            {dayStat?.vm.doctors}A vs {dayStat?.vm.nurses}V
                          </span>
                        )}
                      </th>

                      {/* NM Header */}
                      <th
                        className={`p-1.5 border-l w-[60px] transition-colors ${
                          nmShortage
                            ? 'bg-red-500 text-white font-black border-red-600'
                            : 'bg-slate-50/90 text-slate-600 border-slate-100'
                        }`}
                        title={
                          nmShortage
                            ? `⚠️ TEKORT: ${dayStat?.nm.doctors} artsen vs ${dayStat?.nm.nurses} verpleegkundigen!`
                            : `NM bezetting: ${dayStat?.nm.doctors} artsen en ${dayStat?.nm.nurses} verpleegkundigen`
                        }
                      >
                        NM
                        {nmShortage && (
                          <span className="block text-[8px] leading-none font-bold text-yellow-200 mt-0.5">
                            {dayStat?.nm.doctors}A vs {dayStat?.nm.nurses}V
                          </span>
                        )}
                      </th>
                    </React.Fragment>
                  );
                })}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 text-xs">
              {/* SECTION: ARTSEN */}
              <tr className="bg-blue-50/50 font-extrabold text-blue-900 border-t border-b border-blue-100">
                <td colSpan={11} className="py-2 px-3 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                  Artsen (Dokters) — ({doctors.length})
                </td>
              </tr>

              {doctors.map(doctor => (
                <tr key={doctor.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-2 w-[130px] min-w-[120px] max-w-[135px] sticky left-0 z-10 bg-white border-r border-slate-200 shadow-xs">
                    <div className="font-bold text-slate-800 text-xs truncate" title={doctor.name}>{doctor.name}</div>
                    <span className="text-[10px] text-blue-600 font-semibold">Arts</span>
                  </td>

                  {weekInfo.days.map(d => {
                    const vmStatus = getSlotStatus(doctor, d.dayKey, d.dateStr, 'vm');
                    const nmStatus = getSlotStatus(doctor, d.dayKey, d.dateStr, 'nm');

                    return (
                      <React.Fragment key={`${doctor.id}-${d.dateStr}`}>
                        {/* VM CELL */}
                        <td className="p-1 border-l border-slate-200 text-center align-middle">
                          <InteractiveSlotCell
                            status={vmStatus}
                            staff={doctor}
                            onClick={() => {
                              setActiveQuickSlot({
                                staff: doctor,
                                dateStr: d.dateStr,
                                dayKey: d.dayKey,
                                dayLabel: d.label,
                                formattedDate: d.formattedDate,
                                slot: 'VM',
                                currentLeave: vmStatus.leaveRequest,
                                rawLeaveRequest: vmStatus.rawLeaveRequest,
                                isScheduled: vmStatus.isScheduled,
                                isOverridden: vmStatus.isOverridden
                              });
                            }}
                          />
                        </td>
                        {/* NM CELL */}
                        <td className="p-1 border-l border-slate-100 text-center align-middle">
                          <InteractiveSlotCell
                            status={nmStatus}
                            staff={doctor}
                            onClick={() => {
                              setActiveQuickSlot({
                                staff: doctor,
                                dateStr: d.dateStr,
                                dayKey: d.dayKey,
                                dayLabel: d.label,
                                formattedDate: d.formattedDate,
                                slot: 'NM',
                                currentLeave: nmStatus.leaveRequest,
                                rawLeaveRequest: nmStatus.rawLeaveRequest,
                                isScheduled: nmStatus.isScheduled,
                                isOverridden: nmStatus.isOverridden
                              });
                            }}
                          />
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}

              {/* SECTION: VERPLEEGKUNDIGEN */}
              <tr className="bg-emerald-50/50 font-extrabold text-emerald-900 border-t border-b border-emerald-100">
                <td colSpan={11} className="py-2 px-3 text-xs flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                  Verpleegkundigen — ({nurses.length})
                </td>
              </tr>

              {nurses.map(nurse => (
                <tr key={nurse.id} className="hover:bg-slate-50/60 transition">
                  <td className="p-2 w-[130px] min-w-[120px] max-w-[135px] sticky left-0 z-10 bg-white border-r border-slate-200 shadow-xs">
                    <div className="font-bold text-slate-800 text-xs truncate" title={nurse.name}>{nurse.name}</div>
                    <span className="text-[10px] text-emerald-600 font-semibold">Verpleegkundige</span>
                  </td>

                  {weekInfo.days.map(d => {
                    const vmStatus = getSlotStatus(nurse, d.dayKey, d.dateStr, 'vm');
                    const nmStatus = getSlotStatus(nurse, d.dayKey, d.dateStr, 'nm');

                    return (
                      <React.Fragment key={`${nurse.id}-${d.dateStr}`}>
                        {/* VM CELL */}
                        <td className="p-1 border-l border-slate-200 text-center align-middle">
                          <InteractiveSlotCell
                            status={vmStatus}
                            staff={nurse}
                            onClick={() => {
                              setActiveQuickSlot({
                                staff: nurse,
                                dateStr: d.dateStr,
                                dayKey: d.dayKey,
                                dayLabel: d.label,
                                formattedDate: d.formattedDate,
                                slot: 'VM',
                                currentLeave: vmStatus.leaveRequest,
                                rawLeaveRequest: vmStatus.rawLeaveRequest,
                                isScheduled: vmStatus.isScheduled,
                                isOverridden: vmStatus.isOverridden
                              });
                            }}
                          />
                        </td>
                        {/* NM CELL */}
                        <td className="p-1 border-l border-slate-100 text-center align-middle">
                          <InteractiveSlotCell
                            status={nmStatus}
                            staff={nurse}
                            onClick={() => {
                              setActiveQuickSlot({
                                staff: nurse,
                                dateStr: d.dateStr,
                                dayKey: d.dayKey,
                                dayLabel: d.label,
                                formattedDate: d.formattedDate,
                                slot: 'NM',
                                currentLeave: nmStatus.leaveRequest,
                                rawLeaveRequest: nmStatus.rawLeaveRequest,
                                isScheduled: nmStatus.isScheduled,
                                isOverridden: nmStatus.isOverridden
                              });
                            }}
                          />
                        </td>
                      </React.Fragment>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. DIRECT ACTION MODAL / POPOVER VOOR VERLOF AANPASSEN RECHTSTREEKS */}
      {/* ========================================================================= */}
      {activeQuickSlot && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                  Directe Rooster Actie
                </span>
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-1.5">
                  {activeQuickSlot.staff.role === 'arts' ? '👨‍⚕️' : '🩺'} {activeQuickSlot.staff.name}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {activeQuickSlot.dayLabel} {activeQuickSlot.formattedDate} ({activeQuickSlot.slot === 'VM' ? 'Voormiddag' : 'Namiddag'})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveQuickSlot(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Current Status Box */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
              <span className="text-slate-500 font-semibold block mb-1">Huidige status op dit dagdeel:</span>
              {activeQuickSlot.currentLeave ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-lg font-bold border text-xs ${
                      activeQuickSlot.currentLeave.type === 'verplicht'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                    }`}>
                      {activeQuickSlot.currentLeave.type === 'verplicht' ? 'Verplicht Verlof' : 'Regulier Verlof'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                      activeQuickSlot.currentLeave.status === 'goedgekeurd'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {activeQuickSlot.currentLeave.status === 'goedgekeurd' ? 'Goedgekeurd' : 'In Aanvraag'}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {activeQuickSlot.currentLeave.units} dag
                  </span>
                </div>
              ) : activeQuickSlot.isScheduled ? (
                <div className="flex items-center gap-2 text-emerald-700 font-bold">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>Dienst (Ingeroosterd & Aanwezig)</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-slate-600 font-bold">
                  <span className="w-2 h-2 rounded-full bg-slate-400"></span>
                  <span>Vrij (Niet ingeroosterd)</span>
                </div>
              )}
            </div>

            {/* In Aanvraag Info banner */}
            <div className="px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-medium flex items-center gap-2">
              <Clock className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>Gekozen actie wordt onmiddellijk toegepast en het venster sluit direct.</span>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {activeQuickSlot.currentLeave ? (
                /* Currently on Leave -> Switch Type, Cancel to Dienst, or Set to Vrij */
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">Kies actie voor dit verlof:</span>

                  {/* Switch to Regulier */}
                  {activeQuickSlot.currentLeave.type === 'verplicht' && (
                    <button
                      type="button"
                      onClick={() => handleApplySwitchType('regulier')}
                      className="w-full p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-400 text-indigo-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <span className="font-extrabold text-xs block">
                            Aanpassen naar Regulier Verlof
                          </span>
                          <span className="text-[11px] text-indigo-700/80">
                            Wijzigt type naar regulier
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 shrink-0">Toepassen →</span>
                    </button>
                  )}

                  {/* Switch to Verplicht (only nurses) */}
                  {activeQuickSlot.currentLeave.type === 'regulier' && activeQuickSlot.staff.role === 'verpleegkundige' && (
                    <button
                      type="button"
                      onClick={() => handleApplySwitchType('verplicht')}
                      className="w-full p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-400 text-amber-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <span className="font-extrabold text-xs block">
                            Aanpassen naar Verplicht Verlof
                          </span>
                          <span className="text-[11px] text-amber-700/80">
                            Wijzigt type naar verplicht (+0.5 teller)
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-amber-700 shrink-0">Toepassen →</span>
                    </button>
                  )}

                  {/* Cancel leave and restore Dienst */}
                  <button
                    type="button"
                    onClick={handleApplyCancelLeave}
                    className="w-full p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-400 text-emerald-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="font-extrabold text-xs block">
                          Verlof Terugtrekken (Herstel Dienst)
                        </span>
                        <span className="text-[11px] text-emerald-700/80">
                          Verwijdert het verlof en zet medewerker direct weer op dienst
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 shrink-0">Herstel Dienst →</span>
                  </button>

                  {/* Set to Vrij */}
                  <button
                    type="button"
                    onClick={() => handleApplySetShiftStatus('vrij')}
                    className="w-full p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-600 text-white flex items-center justify-center font-bold shrink-0">
                        —
                      </div>
                      <div className="text-left">
                        <span className="font-extrabold text-xs block">
                          Roosteren als Vrij (Niet Ingeroosterd)
                        </span>
                        <span className="text-[11px] text-slate-600">
                          Verwijdert verlof en markeert als vrijaf
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 shrink-0">Zet op Vrij →</span>
                  </button>
                </div>
              ) : activeQuickSlot.isScheduled ? (
                /* Currently on Dienst -> Give Leave Options or Set to Vrij */
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">Vervang dienst naar verlof of vrij:</span>
                  
                  {/* Button 1: Regulier Verlof (Dit dagdeel) */}
                  <button
                    type="button"
                    onClick={() => handleApplyDirectLeave('regulier', activeQuickSlot.slot)}
                    className="w-full p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-400 text-indigo-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="font-extrabold text-xs block group-hover:text-indigo-900">
                          Regulier Verlof ({activeQuickSlot.slot} · 0.5 dag)
                        </span>
                        <span className="text-[11px] text-indigo-700/80">
                          Alleen voor dagdeel {activeQuickSlot.slot}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 shrink-0">Toekennen →</span>
                  </button>

                  {/* Button 1b: Regulier Verlof (Hele dag) */}
                  <button
                    type="button"
                    onClick={() => handleApplyDirectLeave('regulier', 'HELE_DAG')}
                    className="w-full p-2.5 rounded-xl bg-indigo-50/70 hover:bg-indigo-100/90 border border-indigo-200 hover:border-indigo-400 text-indigo-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-700 text-white flex items-center justify-center font-bold shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="font-extrabold text-xs block group-hover:text-indigo-900">
                          Regulier Verlof (Hele Dag · 1.0 dag)
                        </span>
                        <span className="text-[11px] text-indigo-700/80">
                          Zowel VM als NM direct vervangen door verlof
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 shrink-0">Hele Dag →</span>
                  </button>

                  {/* Button 2: Verplicht Verlof (Only for nurses) */}
                  {activeQuickSlot.staff.role === 'verpleegkundige' ? (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApplyDirectLeave('verplicht', activeQuickSlot.slot)}
                        className="w-full p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-400 text-amber-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <span className="font-extrabold text-xs block group-hover:text-amber-900">
                              Verplicht Verlof ({activeQuickSlot.slot} · 0.5 dag)
                            </span>
                            <span className="text-[11px] text-amber-700/80">
                              Alleen dagdeel {activeQuickSlot.slot} (+0.5 teller)
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-amber-700 shrink-0">Toekennen →</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyDirectLeave('verplicht', 'HELE_DAG')}
                        className="w-full p-2.5 rounded-xl bg-amber-50/70 hover:bg-amber-100/90 border border-amber-200 hover:border-amber-400 text-amber-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-700 text-white flex items-center justify-center font-bold shrink-0">
                            <Sparkles className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <span className="font-extrabold text-xs block group-hover:text-amber-900">
                              Verplicht Verlof (Hele Dag · 1.0 dag)
                            </span>
                            <span className="text-[11px] text-amber-700/80">
                              Zowel VM als NM verplicht (+1.0 teller)
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-amber-700 shrink-0">Hele Dag →</span>
                      </button>
                    </>
                  ) : (
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[11px]">
                      <em>Artsen kunnen volgens praktijkprotocol enkel Regulier verlof opnemen.</em>
                    </div>
                  )}

                  {/* Button 3: Set to Vrij */}
                  <button
                    type="button"
                    onClick={() => handleApplySetShiftStatus('vrij')}
                    className="w-full p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-600 text-white flex items-center justify-center font-bold shrink-0">
                        —
                      </div>
                      <div className="text-left">
                        <span className="font-extrabold text-xs block">
                          Roosteren als Vrij (Niet Ingeroosterd)
                        </span>
                        <span className="text-[11px] text-slate-600">
                          Zet status op vrijaf i.p.v. ingeroosterd
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-slate-700 shrink-0">Zet op Vrij →</span>
                  </button>
                </div>
              ) : (
                /* Currently Vrij -> Schedule Dienst or Direct Leave */
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">Kies actie voor dit vrije moment:</span>

                  {/* Schedule Dienst */}
                  <button
                    type="button"
                    onClick={() => handleApplySetShiftStatus('dienst')}
                    className="w-full p-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-400 text-emerald-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                        <Check className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="font-extrabold text-xs block">
                          Dienst Inplannen ({activeQuickSlot.slot})
                        </span>
                        <span className="text-[11px] text-emerald-700/80">
                          Zet medewerker direct op dienst voor {activeQuickSlot.slot}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-emerald-700 shrink-0">Inplannen →</span>
                  </button>

                  {/* Regulier Verlof */}
                  <button
                    type="button"
                    onClick={() => handleApplyDirectLeave('regulier', activeQuickSlot.slot)}
                    className="w-full p-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 hover:border-indigo-400 text-indigo-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                      <div className="text-left">
                        <span className="font-extrabold text-xs block">
                          Regulier Verlof ({activeQuickSlot.slot} · 0.5 dag)
                        </span>
                        <span className="text-[11px] text-indigo-700/80">
                          Direct toekennen als verlof
                        </span>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 shrink-0">Toekennen →</span>
                  </button>

                  {/* Verplicht Verlof (nurses only) */}
                  {activeQuickSlot.staff.role === 'verpleegkundige' && (
                    <button
                      type="button"
                      onClick={() => handleApplyDirectLeave('verplicht', activeQuickSlot.slot)}
                      className="w-full p-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-200 hover:border-amber-400 text-amber-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-600 text-white flex items-center justify-center font-bold shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div className="text-left">
                          <span className="font-extrabold text-xs block">
                            Verplicht Verlof ({activeQuickSlot.slot} · 0.5 dag)
                          </span>
                          <span className="text-[11px] text-amber-700/80">
                            Direct toekennen (+0.5 teller)
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-amber-700 shrink-0">Toekennen →</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* VAST WERKSCHEMA DIRECTE SYNCHRONISATIE */}
            {onUpdateStaffSchedule && (
              <div className="pt-2 border-t border-slate-100">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-indigo-600" />
                      Vast Werkschema ({activeQuickSlot.dayLabel} {activeQuickSlot.slot})
                    </span>
                    <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold ${
                      (activeQuickSlot.staff.schedule?.[activeQuickSlot.dayKey]?.[activeQuickSlot.slot.toLowerCase() as 'vm' | 'nm'])
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-200 text-slate-700'
                    }`}>
                      {(activeQuickSlot.staff.schedule?.[activeQuickSlot.dayKey]?.[activeQuickSlot.slot.toLowerCase() as 'vm' | 'nm'])
                        ? 'Standaard Ingeroosterd'
                        : 'Standaard Vrij'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-tight">
                    Elke wijziging hier wordt direct live gesynchroniseerd met het vaste werkschema van {activeQuickSlot.staff.name}.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const isCurrentlyActive = Boolean(
                        activeQuickSlot.staff.schedule?.[activeQuickSlot.dayKey]?.[activeQuickSlot.slot.toLowerCase() as 'vm' | 'nm']
                      );
                      handleApplyPermanentFixedSchedule(!isCurrentlyActive);
                    }}
                    className="w-full py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 flex items-center justify-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>
                      {(activeQuickSlot.staff.schedule?.[activeQuickSlot.dayKey]?.[activeQuickSlot.slot.toLowerCase() as 'vm' | 'nm'])
                        ? `Permanent op Vrij zetten in vast schema (${activeQuickSlot.dayLabel} ${activeQuickSlot.slot})`
                        : `Permanent op Dienst zetten in vast schema (${activeQuickSlot.dayLabel} ${activeQuickSlot.slot})`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveQuickSlot(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface InteractiveSlotCellProps {
  status: {
    isScheduled: boolean;
    leaveRequest?: LeaveRequest;
    isOverridden?: boolean;
  };
  staff: StaffMember;
  onClick: () => void;
}

const InteractiveSlotCell: React.FC<InteractiveSlotCellProps> = ({ status, staff: _staff, onClick }) => {
  const { isScheduled, leaveRequest } = status;

  // Case 1: Has Leave Request
  if (leaveRequest) {
    const isApproved = leaveRequest.status === 'goedgekeurd';
    const isPending = leaveRequest.status === 'aangevraagd';
    const isCompulsory = leaveRequest.type === 'verplicht';

    if (isCompulsory) {
      return (
        <button
          type="button"
          onClick={onClick}
          title={`Verplicht Verlof (${isApproved ? 'Goedgekeurd' : 'In Aanvraag'}). Klik om aan te passen of terug te trekken.`}
          className={`w-full h-9 rounded-lg flex flex-col items-center justify-center p-0.5 shadow-2xs transition cursor-pointer group ${
            isPending
              ? 'bg-amber-50 hover:bg-amber-100 border-2 border-dashed border-amber-400 text-amber-950'
              : 'bg-amber-100 hover:bg-amber-200/90 border border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-700 group-hover:scale-110 transition-transform" />
            {isPending && <Clock className="w-2.5 h-2.5 text-amber-600" />}
          </div>
          <span className="text-[9px] font-black leading-none mt-0.5 text-amber-900">
            {isPending ? 'Verpl. (Aanvr)' : 'Verpl.'}
          </span>
        </button>
      );
    }

    return (
      <button
        type="button"
        onClick={onClick}
        title={`Regulier Verlof (${isApproved ? 'Goedgekeurd' : 'In Aanvraag'}). Klik om aan te passen of terug te trekken.`}
        className={`w-full h-9 rounded-lg flex flex-col items-center justify-center p-0.5 shadow-2xs transition cursor-pointer group ${
          isPending
            ? 'bg-indigo-50 hover:bg-indigo-100 border-2 border-dashed border-indigo-400 text-indigo-950'
            : 'bg-indigo-100 hover:bg-indigo-200/90 border border-indigo-300 text-indigo-950'
        }`}
      >
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-indigo-700 group-hover:scale-110 transition-transform" />
          {isPending && <Clock className="w-2.5 h-2.5 text-indigo-600" />}
        </div>
        <span className="text-[9px] font-black leading-none mt-0.5 text-indigo-900">
          {isPending ? 'Verlof (Aanvr)' : 'Verlof'}
        </span>
      </button>
    );
  }

  // Case 2: Scheduled to work
  if (isScheduled) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Dienst (Aanwezig). Klik om direct te kiezen voor Regulier of Verplicht verlof of Vrij."
        className="w-full h-9 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80 text-emerald-800 flex flex-col items-center justify-center transition cursor-pointer group hover:shadow-2xs"
      >
        <Check className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
        <span className="text-[9px] font-extrabold leading-none mt-0.5 text-emerald-700">Dienst</span>
      </button>
    );
  }

  // Case 3: Not scheduled (Free) -> Now clickable as well!
  return (
    <button
      type="button"
      onClick={onClick}
      title="Vrij (Niet ingeroosterd). Klik om dienst in te plannen of verlof toe te kennen."
      className="w-full h-9 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-400 hover:text-slate-600 flex flex-col items-center justify-center transition cursor-pointer group"
    >
      <span className="text-[10px] font-bold leading-none">—</span>
      <span className="text-[8px] font-semibold leading-none mt-0.5 text-slate-400 group-hover:text-slate-600">Vrij</span>
    </button>
  );
};
