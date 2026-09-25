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
  LeaveStatus,
  DayOfWeekKey
} from '../../types';
import {
  DAYS_OF_WEEK,
  getISOWeekDetails,
  calculateCompulsoryLeaveCounter,
  validateLeaveRequest,
  isLeaveRequestForStaff,
  getBelgianHoliday
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
  Briefcase,
  Info
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
  onUpdateLeaveStatus?: (requestId: string, newStatus: LeaveStatus, rejectionReason?: string) => Promise<void>;
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
  onUpdateLeaveStatus
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

  // Rejection modal state
  const [rejectModalRequest, setRejectModalRequest] = useState<LeaveRequest | null>(null);
  const [rejectReasonText, setRejectReasonText] = useState<string>('');
  const [rejectReasonError, setRejectReasonError] = useState<string | null>(null);

  // Direct 1-click approve from the overview grid
  const handleDirectApprove = async (requestId: string) => {
    if (!onUpdateLeaveStatus) return;
    try {
      await onUpdateLeaveStatus(requestId, 'goedgekeurd');
    } catch (err) {
      console.error('Fout bij direct goedkeuren van verlofaanvraag:', err);
    }
  };

  // Direct reject opens the rejection modal requiring a reason
  const handleDirectReject = (target: LeaveRequest | string) => {
    const req = typeof target === 'string' ? leaveRequests.find(r => r.id === target) : target;
    if (req) {
      setRejectModalRequest(req);
      setRejectReasonText('');
      setRejectReasonError(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectModalRequest || !onUpdateLeaveStatus) return;
    const trimmed = rejectReasonText.trim();
    if (!trimmed) {
      setRejectReasonError('Gelieve een reden voor de afkeuring in te vullen.');
      return;
    }
    try {
      await onUpdateLeaveStatus(rejectModalRequest.id, 'afgekeurd', trimmed);
      setRejectModalRequest(null);
      setRejectReasonText('');
      setRejectReasonError(null);
      if (activeQuickSlot?.currentLeave?.id === rejectModalRequest.id) {
        setActiveQuickSlot(null);
      }
    } catch (err) {
      console.error('Fout bij afkeuren van verlofaanvraag:', err);
      setRejectReasonError('Er is een fout opgetreden bij het afkeuren.');
    }
  };

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
    let req = leaveRequests.find(r => {
      if (!isLeaveRequestForStaff(r, staff) || r.date !== dateStr) return false;
      if (r.status === 'afgekeurd') return false; // Rejected leave does not count
      const rSlot = (r.slot || '').toUpperCase();
      if (rSlot === 'HELE_DAG') return true;
      if (slot.toUpperCase() === rSlot) return true;
      return false;
    });

    // Check if this date is an official Belgian statutory public holiday
    const holidayName = getBelgianHoliday(dateStr);
    if (!req && holidayName) {
      req = {
        id: `holiday-${dateStr}-${staff.id}`,
        staff_id: staff.id,
        staff_name: staff.name,
        date: dateStr,
        slot: 'HELE_DAG',
        units: 1.0,
        type: 'feestdag',
        status: 'goedgekeurd',
        note: `Wettelijke feestdag in België: ${holidayName} (Automatisch verlof voor iedereen)`,
        created_at: new Date().toISOString()
      };
    }

    // An active leave request (approved or requested) always applies and shows in the schema
    const effectiveLeaveRequest = req;

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
      // If it is a statutory Belgian holiday, the practice is closed and there is no shortage
      if (d.isHoliday) {
        stats[d.dateStr] = {
          vm: { doctors: 0, nurses: 0, isShortage: false },
          nm: { doctors: 0, nurses: 0, isShortage: false },
          dayHasShortage: false
        };
        return;
      }

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
        // A nurse is working if scheduled without leave OR if working an approved gecompenseerde werkdag
        const isWorking =
          (status.isScheduled && (!status.leaveRequest || (status.leaveRequest.type === 'gecompenseerd' && status.leaveRequest.status === 'goedgekeurd'))) ||
          (!status.isScheduled && status.leaveRequest?.type === 'gecompenseerd' && status.leaveRequest.status === 'goedgekeurd');
        if (isWorking) {
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
        const isWorking =
          (status.isScheduled && (!status.leaveRequest || (status.leaveRequest.type === 'gecompenseerd' && status.leaveRequest.status === 'goedgekeurd'))) ||
          (!status.isScheduled && status.leaveRequest?.type === 'gecompenseerd' && status.leaveRequest.status === 'goedgekeurd');
        if (isWorking) {
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
        {/* Table Legend & Actions */}
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
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-50 border-2 border-dashed border-teal-500"></span>
              <span className="text-slate-600 text-[11px]">Gecompenseerd (In Aanvr)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-teal-100 border border-teal-500"></span>
              <span className="text-slate-600 text-[11px]">Gecompenseerd (Goedgekeurd · -teller)</span>
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
                          : d.isHoliday
                          ? 'bg-rose-50 text-rose-950 border-rose-200'
                          : 'bg-slate-100/90 text-slate-800 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {hasShortage && (
                          <AlertTriangle className="w-3.5 h-3.5 text-yellow-300 animate-bounce" />
                        )}
                        <span className={`font-black text-xs ${
                          hasShortage ? 'text-white' : d.isHoliday ? 'text-rose-900' : 'text-slate-800'
                        }`}>
                          {d.label}
                        </span>
                      </div>
                      <div className={`text-[11px] font-normal ${
                        hasShortage ? 'text-red-100 font-semibold' : d.isHoliday ? 'text-rose-700 font-semibold' : 'text-slate-500'
                      }`}>
                        {d.formattedDate}
                      </div>
                      {hasShortage && (
                        <div className="mt-1 inline-block px-2 py-0.5 bg-red-800/90 text-white rounded-md text-[10px] font-black tracking-tight">
                          TEKORT VERPLEGING
                        </div>
                      )}
                      {d.isHoliday && (
                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100/90 text-rose-800 border border-rose-200 rounded-md text-[10px] font-black tracking-tight">
                          <span>🇧🇪</span>
                          <span>{d.holidayName || 'Feestdag'}</span>
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
                            onDirectApprove={handleDirectApprove}
                            onDirectReject={handleDirectReject}
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
                            onDirectApprove={handleDirectApprove}
                            onDirectReject={handleDirectReject}
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
                            onDirectApprove={handleDirectApprove}
                            onDirectReject={handleDirectReject}
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
                            onDirectApprove={handleDirectApprove}
                            onDirectReject={handleDirectReject}
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
                      activeQuickSlot.currentLeave.type === 'feestdag'
                        ? 'bg-rose-100 text-rose-950 border-rose-300'
                        : activeQuickSlot.currentLeave.type === 'gecompenseerd'
                        ? 'bg-teal-100 text-teal-950 border-teal-300'
                        : activeQuickSlot.currentLeave.type === 'verplicht'
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-indigo-100 text-indigo-900 border-indigo-300'
                    }`}>
                      {activeQuickSlot.currentLeave.type === 'feestdag'
                        ? '🇧🇪 Feestdag'
                        : activeQuickSlot.currentLeave.type === 'gecompenseerd'
                        ? '💼 Compensatiedag'
                        : activeQuickSlot.currentLeave.type === 'verplicht'
                        ? 'Verplicht Verlof'
                        : 'Regulier Verlof'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold ${
                      activeQuickSlot.currentLeave.status === 'goedgekeurd'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}>
                      {activeQuickSlot.currentLeave.status === 'goedgekeurd'
                        ? (activeQuickSlot.currentLeave.type === 'gecompenseerd' ? 'Goedgekeurd (-teller)' : 'Goedgekeurd')
                        : 'In Aanvraag'}
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

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              {activeQuickSlot.currentLeave ? (
                /* Currently on Leave / Gecompenseerd -> Actions */
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">Kies actie voor deze status:</span>

                  {/* If this is a Belgian statutory holiday */}
                  {activeQuickSlot.currentLeave.type === 'feestdag' ? (
                    <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-rose-950">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">🇧🇪</span>
                        <div>
                          <h4 className="font-extrabold text-xs text-rose-900">
                            Wettelijke Belgische Feestdag
                          </h4>
                          <p className="text-[11px] text-rose-700 font-semibold">
                            {activeQuickSlot.currentLeave.note || 'Officiële feestdag in België'}
                          </p>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 bg-white/80 p-2.5 rounded-lg border border-rose-100">
                        Op deze officiële feestdag is de praktijk gesloten en heeft elk personeelslid (artsen en verpleegkundigen) automatisch goedgekeurd wettelijk verlof.
                      </p>
                    </div>
                  ) : activeQuickSlot.currentLeave.type === 'gecompenseerd' ? (
                    <>
                      {/* Notice: Approvals can only be made via the checkmark in the grid */}
                      {activeQuickSlot.currentLeave.status === 'aangevraagd' && (
                        <div className="p-3 bg-teal-50/80 border border-teal-200/80 rounded-xl flex items-center gap-2.5 text-xs text-teal-900">
                          <Info className="w-4 h-4 text-teal-700 shrink-0" />
                          <span>
                            <strong>Goedkeuren:</strong> Klik op het groene vinkje (✓) in het weekoverzicht om goed te keuren.
                          </span>
                        </div>
                      )}

                      {/* Afkeuren with Reason button if pending */}
                      {activeQuickSlot.currentLeave.status === 'aangevraagd' && (
                        <button
                          type="button"
                          onClick={() => {
                            const req = activeQuickSlot.currentLeave!;
                            setActiveQuickSlot(null);
                            handleDirectReject(req);
                          }}
                          className="w-full p-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-400 text-red-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold shrink-0">
                              <X className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <div className="text-left">
                              <span className="font-extrabold text-xs block">
                                Aanvraag Afkeuren met Reden
                              </span>
                              <span className="text-[11px] text-red-700/80">
                                Wijst deze aanvraag af met verplichte toelichting
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-red-700 shrink-0">Afkeuren ✕</span>
                        </button>
                      )}

                      {/* Cancel / Withdraw Gecompenseerde Werkdag */}
                      <button
                        type="button"
                        onClick={handleApplyCancelLeave}
                        className="w-full p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 hover:border-rose-400 text-rose-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold shrink-0">
                            <X className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <span className="font-extrabold text-xs block">
                              {activeQuickSlot.currentLeave.status === 'aangevraagd'
                                ? 'Aanvraag Intrekken / Verwijderen'
                                : 'Compensatiedag Annuleren'}
                            </span>
                            <span className="text-[11px] text-rose-700/80">
                              Verwijdert deze compensatiedag en herstelt de verplicht verlof teller
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-rose-700 shrink-0">Verwijderen →</span>
                      </button>
                    </>
                  ) : (
                    /* Normal Leave (Regulier or Verplicht) */
                    <>
                      {/* Notice: Approvals can only be made via the checkmark in the grid or approval tab */}
                      {activeQuickSlot.currentLeave.status === 'aangevraagd' && (
                        <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl flex items-center gap-2.5 text-xs text-amber-900">
                          <Info className="w-4 h-4 text-amber-700 shrink-0" />
                          <span>
                            <strong>Goedkeuren:</strong> Klik op het groene vinkje (✓) in het overzicht of gebruik de wachtrijlijst in het tabblad 'Beoordelen'.
                          </span>
                        </div>
                      )}

                      {/* Afkeuren with Reason button if pending */}
                      {activeQuickSlot.currentLeave.status === 'aangevraagd' && (
                        <button
                          type="button"
                          onClick={() => {
                            const req = activeQuickSlot.currentLeave!;
                            setActiveQuickSlot(null);
                            handleDirectReject(req);
                          }}
                          className="w-full p-2.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-400 text-red-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold shrink-0">
                              <X className="w-4 h-4 stroke-[2.5]" />
                            </div>
                            <div className="text-left">
                              <span className="font-extrabold text-xs block">
                                Aanvraag Afkeuren met Reden
                              </span>
                              <span className="text-[11px] text-red-700/80">
                                Wijst deze verlofaanvraag af met verplichte toelichting
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-red-700 shrink-0">Afkeuren ✕</span>
                        </button>
                      )}

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

                      {/* Switch to Gecompenseerd (only nurses) */}
                      {activeQuickSlot.staff.role === 'verpleegkundige' && (
                        <button
                          type="button"
                          onClick={() => handleApplySwitchType('gecompenseerd')}
                          className="w-full p-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 hover:border-teal-400 text-teal-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold shrink-0">
                              <Briefcase className="w-4 h-4" />
                            </div>
                            <div className="text-left">
                              <span className="font-extrabold text-xs block">
                                Aanpassen naar Compensatiedag
                              </span>
                              <span className="text-[11px] text-teal-700/80">
                                Wijzigt type naar compensatiedag (-0.5 teller)
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-teal-700 shrink-0">Aanvragen →</span>
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
                    </>
                  )}
                </div>
              ) : activeQuickSlot.isScheduled ? (
                /* Currently on Dienst -> Give Leave Options */
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">Vervang dienst door verlof:</span>
                  
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
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 shrink-0">Aanvragen →</span>
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
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 shrink-0">Aanvragen →</span>
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
                          </div>
                        </div>
                        <span className="text-xs font-bold text-amber-700 shrink-0">Aanvragen →</span>
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
                          </div>
                        </div>
                        <span className="text-xs font-bold text-amber-700 shrink-0">Aanvragen →</span>
                      </button>
                    </>
                  ) : (
                    <div className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-500 text-[11px]">
                      <em>Artsen kunnen volgens praktijkprotocol enkel Regulier verlof opnemen.</em>
                    </div>
                  )}
                </div>
              ) : (
                /* Currently Vrij -> Direct Leave or Extra Work */
                <div className="space-y-2">
                  <span className="text-xs font-bold text-slate-700 block">Kies actie voor dit vrije moment:</span>

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
                      </div>
                    </div>
                    <span className="text-xs font-bold text-indigo-600 shrink-0">Aanvragen →</span>
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
                        </div>
                      </div>
                      <span className="text-xs font-bold text-amber-700 shrink-0">Aanvragen →</span>
                    </button>
                  )}

                  {/* Compensatiedag (nurses only) */}
                  {activeQuickSlot.staff.role === 'verpleegkundige' && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleApplyDirectLeave('gecompenseerd', activeQuickSlot.slot)}
                        className="w-full p-2.5 rounded-xl bg-teal-50 hover:bg-teal-100 border border-teal-200 hover:border-teal-400 text-teal-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-teal-600 text-white flex items-center justify-center font-bold shrink-0">
                            <Briefcase className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <span className="font-extrabold text-xs block group-hover:text-teal-900">
                              Compensatiedag ({activeQuickSlot.slot} · 0.5 dag)
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-teal-700 shrink-0">Aanvragen →</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApplyDirectLeave('gecompenseerd', 'HELE_DAG')}
                        className="w-full p-2.5 rounded-xl bg-teal-50/70 hover:bg-teal-100/90 border border-teal-200 hover:border-teal-400 text-teal-950 flex items-center justify-between transition cursor-pointer group shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center font-bold shrink-0">
                            <Briefcase className="w-4 h-4" />
                          </div>
                          <div className="text-left">
                            <span className="font-extrabold text-xs block group-hover:text-teal-900">
                              Compensatiedag (Hele Dag · 1.0 dag)
                            </span>
                          </div>
                        </div>
                        <span className="text-xs font-bold text-teal-700 shrink-0">Aanvragen →</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

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

      {/* REJECTION REASON MODAL */}
      {rejectModalRequest && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-red-700">
                <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <X className="w-4 h-4 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-red-950">Verlofaanvraag Afkeuren</h3>
                  <p className="text-[11px] text-red-700">Geef een verplichte reden op voor deze afkeuring</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRejectModalRequest(null);
                  setRejectReasonText('');
                  setRejectReasonError(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-white/80 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Request summary */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Medewerker:</span>
                  <span className="font-bold text-slate-900">{rejectModalRequest.staff_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Datum & Dagdeel:</span>
                  <span className="font-bold text-slate-900">
                    {rejectModalRequest.date} ({rejectModalRequest.slot === 'HELE_DAG' ? 'Hele dag' : rejectModalRequest.slot})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500 font-medium">Type:</span>
                  <span className="font-bold text-slate-900 capitalize">{rejectModalRequest.type} verlof</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Reden van afkeuring <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rejectReasonText}
                  onChange={(e) => {
                    setRejectReasonText(e.target.value);
                    if (rejectReasonError) setRejectReasonError(null);
                  }}
                  placeholder="Typ hier de reden (bijv. bezettingsnorm niet gehaald, geen vervanging mogelijk)..."
                  rows={3}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white transition resize-none"
                  autoFocus
                />
                {rejectReasonError && (
                  <p className="text-xs text-red-600 font-medium mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{rejectReasonError}</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setRejectModalRequest(null);
                    setRejectReasonText('');
                    setRejectReasonError(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Afkeuring Bevestigen</span>
                </button>
              </div>
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
    rawLeaveRequest?: LeaveRequest;
    isOverridden?: boolean;
  };
  staff: StaffMember;
  onDirectApprove?: (requestId: string) => void;
  onDirectReject?: (target: LeaveRequest) => void;
  onClick: () => void;
}

const InteractiveSlotCell: React.FC<InteractiveSlotCellProps> = ({
  status,
  staff: _staff,
  onDirectApprove,
  onDirectReject,
  onClick
}) => {
  const { isScheduled, leaveRequest, rawLeaveRequest } = status;
  const req = leaveRequest || rawLeaveRequest;

  // Case 1: Active Leave Request exists
  if (req) {
    const isApproved = req.status === 'goedgekeurd';
    const isPending = req.status === 'aangevraagd';
    const isCompulsory = req.type === 'verplicht';
    const isCompensated = req.type === 'gecompenseerd';
    const isHoliday = req.type === 'feestdag';

    // 1A. Wettelijke Feestdag
    if (isHoliday) {
      return (
        <button
          type="button"
          onClick={onClick}
          title={`Wettelijke Feestdag: ${req.note || 'Belgische Feestdag'} (Verlof voor iedereen). Klik om details te bekijken.`}
          className="w-full h-9 rounded-lg flex flex-col items-center justify-center p-0.5 shadow-2xs transition cursor-pointer group bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-950"
        >
          <div className="flex items-center gap-1">
            <span className="text-[11px] leading-none">🇧🇪</span>
            <Check className="w-2.5 h-2.5 text-rose-700 stroke-[3]" />
          </div>
          <span className="text-[9px] font-black leading-none mt-0.5 text-rose-900">
            Feestdag ✓
          </span>
        </button>
      );
    }

    // 1B. IN AANVRAAG -> Direct Goedkeuren (✓) & Afkeuren (✕) knoppen in de cel
    if (isPending) {
      return (
        <div
          onClick={onClick}
          title={`In Aanvraag: ${
            isCompensated
              ? 'Gecompenseerde Werkdag (-0.5d teller)'
              : isCompulsory
              ? 'Verplicht verlof'
              : 'Regulier verlof'
          }. Klik op ✓ om direct goed te keuren, ✕ om af te keuren met reden.`}
          className={`w-full min-h-[44px] rounded-lg p-1 flex flex-col items-center justify-between transition cursor-pointer shadow-2xs group relative border-2 border-dashed ${
            isCompensated
              ? 'bg-teal-50 hover:bg-teal-100/90 border-teal-500 text-teal-950'
              : isCompulsory
              ? 'bg-amber-50 hover:bg-amber-100/90 border-amber-400 text-amber-950'
              : 'bg-indigo-50 hover:bg-indigo-100/90 border-indigo-400 text-indigo-950'
          }`}
        >
          <div className="flex items-center justify-between w-full px-0.5">
            <span className="text-[9px] font-black leading-none truncate">
              {isCompensated ? 'Gecomp.' : isCompulsory ? 'Verpl.' : 'Verlof'}
            </span>
            <Clock className="w-2.5 h-2.5 text-amber-600 shrink-0 animate-pulse" />
          </div>

          {/* Rechtstreeks Goedkeuren / Afkeuren buttons */}
          <div className="flex items-center justify-center gap-1.5 w-full mt-0.5">
            {onDirectApprove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDirectApprove(req.id);
                }}
                title="Direct Goedkeuren (1-klik)"
                className="w-5 h-5 rounded bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center transition shadow-xs hover:scale-110 cursor-pointer shrink-0"
              >
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            )}
            {onDirectReject && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDirectReject(req);
                }}
                title="Afkeuren met reden"
                className="w-5 h-5 rounded bg-white hover:bg-red-50 text-red-600 border border-red-300 hover:border-red-400 flex items-center justify-center transition shadow-xs hover:scale-110 cursor-pointer shrink-0"
              >
                <X className="w-3 h-3 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>
      );
    }

    // 1C. Gecompenseerd (Goedgekeurd)
    if (isCompensated) {
      return (
        <button
          type="button"
          onClick={onClick}
          title="Gecompenseerde Werkdag (Goedgekeurd · -0.5d teller). Klik voor opties."
          className="w-full h-9 rounded-lg flex flex-col items-center justify-center p-0.5 shadow-2xs transition cursor-pointer group bg-teal-100 hover:bg-teal-200/90 border border-teal-400 text-teal-950"
        >
          <div className="flex items-center gap-1">
            <Briefcase className="w-3 h-3 text-teal-700 group-hover:scale-110 transition-transform" />
            <Check className="w-2.5 h-2.5 text-teal-700 stroke-[3]" />
          </div>
          <span className="text-[9px] font-black leading-none mt-0.5 text-teal-900">
            Gecomp.
          </span>
        </button>
      );
    }

    // 1D. Verplicht verlof (Goedgekeurd)
    if (isCompulsory) {
      return (
        <button
          type="button"
          onClick={onClick}
          title="Verplicht Verlof (Goedgekeurd). Klik voor opties."
          className="w-full h-9 rounded-lg flex flex-col items-center justify-center p-0.5 shadow-2xs transition cursor-pointer group bg-amber-100 hover:bg-amber-200/90 border border-amber-400 text-amber-950"
        >
          <div className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-700 group-hover:scale-110 transition-transform" />
            <Check className="w-2.5 h-2.5 text-amber-800 stroke-[3]" />
          </div>
          <span className="text-[9px] font-black leading-none mt-0.5 text-amber-900">
            Verpl. ✓
          </span>
        </button>
      );
    }

    // 1E. Regulier verlof (Goedgekeurd)
    return (
      <button
        type="button"
        onClick={onClick}
        title="Regulier Verlof (Goedgekeurd). Klik voor opties."
        className="w-full h-9 rounded-lg flex flex-col items-center justify-center p-0.5 shadow-2xs transition cursor-pointer group bg-indigo-100 hover:bg-indigo-200/90 border border-indigo-400 text-indigo-950"
      >
        <div className="flex items-center gap-1">
          <ShieldCheck className="w-3 h-3 text-indigo-700 group-hover:scale-110 transition-transform" />
          <Check className="w-2.5 h-2.5 text-indigo-800 stroke-[3]" />
        </div>
        <span className="text-[9px] font-black leading-none mt-0.5 text-indigo-900">
          Verlof ✓
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
