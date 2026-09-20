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
  LeaveStatus,
  DayOfWeekKey
} from '../../types';
import {
  DAYS_OF_WEEK,
  getISOWeekDetails,
  isLeaveRequestForStaff,
  findMatchingStaff
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
  PauseCircle,
  CheckSquare,
  Search,
  Filter,
  CheckCheck,
  Pin,
  CalendarDays,
  FileText,
  RefreshCw,
  Sparkles,
  Briefcase
} from 'lucide-react';

export interface LeaveApprovalSubmoduleProps {
  staffList: StaffMember[];
  leaveRequests: LeaveRequest[];
  comments?: GeneralComment[];
  todos?: TodoItem[];
  shiftOverrides?: Record<string, 'dienst' | 'vrij'>;
  onAddComment?: (comment: Omit<GeneralComment, 'id' | 'created_at'>) => Promise<void>;
  onDeleteComment?: (commentId: string) => Promise<void>;
  onAddTodo?: (todo: Omit<TodoItem, 'id' | 'created_at'>) => Promise<void>;
  onToggleTodo?: (todoId: string, currentCompleted: boolean) => Promise<void>;
  onDeleteTodo?: (todoId: string) => Promise<void>;
  onRestoreTodo?: (todoId: string) => Promise<void>;
  onUpdateStatus: (requestId: string, status: LeaveStatus, note?: string) => Promise<void>;
  onUpdateNote?: (requestId: string, note: string) => Promise<void>;
  onDeleteRequest: (requestId: string) => Promise<void>;
  onBatchApproveAllPending?: () => Promise<void>;
}

interface ActiveApprovalModalState {
  staff: StaffMember;
  dateStr: string;
  dayKey: DayOfWeekKey;
  slot: LeaveSlot;
  leaveRequest?: LeaveRequest;
  rawLeaveRequest?: LeaveRequest;
  daySchedule: { vm: boolean; nm: boolean };
  dayLabel: string;
  formattedDate: string;
}

interface DayActionModalState {
  dateStr: string;
  dayLabel: string;
  formattedDate: string;
}

export const LeaveApprovalSubmodule: React.FC<LeaveApprovalSubmoduleProps> = ({
  staffList,
  leaveRequests,
  comments = [],
  todos = [],
  shiftOverrides = {},
  onAddComment,
  onDeleteComment,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onRestoreTodo,
  onUpdateStatus,
  onUpdateNote,
  onDeleteRequest,
  onBatchApproveAllPending
}) => {
  // Navigation & View State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<'rooster' | 'wachtrij'>('rooster');

  // Modal States
  const [activeApprovalSlot, setActiveApprovalSlot] = useState<ActiveApprovalModalState | null>(null);
  const [activeDayAction, setActiveDayAction] = useState<DayActionModalState | null>(null);

  // In-Modal form state for Note, Todo and Day Comment
  const [modalNoteText, setModalNoteText] = useState('');
  const [modalTodoTitle, setModalTodoTitle] = useState('');
  const [modalTodoDeadline, setModalTodoDeadline] = useState('');
  const [modalDayCommentText, setModalDayCommentText] = useState('');
  const [modalCommentAuthorId, setModalCommentAuthorId] = useState(staffList[0]?.id || '');
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);

  // Day Action Modal form state
  const [dayCommentText, setDayCommentText] = useState('');
  const [dayCommentAuthorId, setDayCommentAuthorId] = useState(staffList[0]?.id || '');
  const [dayTodoTitle, setDayTodoTitle] = useState('');
  const [dayModalFeedback, setDayModalFeedback] = useState<string | null>(null);

  // Top Comments Form State
  const [commentText, setCommentText] = useState('');
  const [commentAuthorId, setCommentAuthorId] = useState<string>(staffList[0]?.id || '');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Top Todo Form State
  const [todoTitle, setTodoTitle] = useState('');
  const [todoDeadline, setTodoDeadline] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [isSubmittingTodo, setIsSubmittingTodo] = useState(false);

  // Wachtrij list filter states - default to pending approval queue
  const [filterStatus, setFilterStatus] = useState<string>('aangevraagd');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Keep author IDs aligned when staffList loads or changes
  React.useEffect(() => {
    if (staffList.length > 0) {
      if (!commentAuthorId || !staffList.some(s => s.id === commentAuthorId)) {
        setCommentAuthorId(staffList[0].id);
      }
      if (!dayCommentAuthorId || !staffList.some(s => s.id === dayCommentAuthorId)) {
        setDayCommentAuthorId(staffList[0].id);
      }
      if (!modalCommentAuthorId || !staffList.some(s => s.id === modalCommentAuthorId)) {
        setModalCommentAuthorId(staffList[0].id);
      }
    }
  }, [staffList, commentAuthorId, dayCommentAuthorId, modalCommentAuthorId]);

  // 1. Calculate week info for current date
  const weekInfo = useMemo(() => getISOWeekDetails(currentDate), [currentDate]);

  // Split staff into Doctors and Nurses
  const doctors = useMemo(() => staffList.filter(s => s.role === 'arts'), [staffList]);
  const nurses = useMemo(() => staffList.filter(s => s.role === 'verpleegkundige'), [staffList]);

  // Filter comments for current week
  const currentWeekComments = useMemo(() => {
    return comments
      .filter(c => c.week_identifier === weekInfo.identifier)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [comments, weekInfo.identifier]);

  // Split todos into Active and Archived
  const activeTodos = useMemo(() => todos.filter(t => !t.archived), [todos]);
  const archivedTodos = useMemo(() => todos.filter(t => t.archived), [todos]);

  // Week navigation helpers
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

  const handleJumpToDate = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      const parts = e.target.value.split('-');
      if (parts.length === 3) {
        const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        if (!isNaN(d.getTime())) {
          setCurrentDate(d);
        }
      }
    }
  };

  // Top Comment submit handler
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text || !onAddComment) return;

    // Immediately clear input so the user can type a new comment right away
    setCommentText('');
    setIsSubmittingComment(true);
    try {
      const authorId = commentAuthorId || staffList[0]?.id || '';
      const author = staffList.find(s => s.id === authorId);
      await onAddComment({
        week_identifier: weekInfo.identifier,
        author_id: authorId,
        author_name: author ? author.name : 'Coördinator',
        message: text
      });
    } catch (err) {
      console.error('Fout bij plaatsen opmerking:', err);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Top Todo submit handler
  const handlePostTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = todoTitle.trim();
    const deadline = todoDeadline || undefined;
    if (!title || !onAddTodo) return;

    // Immediately clear input fields so new tasks can be entered without remaining text
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

  // Helper to check slot status for a staff member on a specific day
  const getSlotStatus = (staff: StaffMember, dayKey: DayOfWeekKey, dateStr: string, slot: 'vm' | 'nm') => {
    const overrideKey = `${staff.id}_${dateStr}_${slot}`;
    const hasOverride = Boolean(shiftOverrides && shiftOverrides[overrideKey] !== undefined);
    const isScheduled = hasOverride
      ? shiftOverrides[overrideKey] === 'dienst'
      : (staff.schedule?.[dayKey]?.[slot] ?? false);

    // Look for leave request on this date and slot
    const req = leaveRequests.find(r => {
      if (!isLeaveRequestForStaff(r, staff) || r.date !== dateStr) return false;
      const rSlot = (r.slot || '').toUpperCase();
      if (rSlot === 'HELE_DAG') return true;
      if (slot.toUpperCase() === rSlot) return true;
      return false;
    });

    return {
      isScheduled,
      leaveRequest: req,
      rawLeaveRequest: req,
      isOverridden: hasOverride
    };
  };

  // =========================================================================
  // RATIO CHECK: 1 VERPLEEGKUNDIGE VOOR 1 ARTS
  // =========================================================================
  const slotStaffingStats = useMemo(() => {
    const stats: Record<string, {
      vm: { doctors: number; nurses: number; isShortage: boolean };
      nm: { doctors: number; nurses: number; isShortage: boolean };
      dayHasShortage: boolean;
    }> = {};

    weekInfo.days.forEach(d => {
      // VM
      let vmDocs = 0;
      doctors.forEach(doc => {
        const status = getSlotStatus(doc, d.dayKey, d.dateStr, 'vm');
        // If on leave (and not rejected), doc is not present
        if (status.isScheduled && (!status.leaveRequest || status.leaveRequest.status === 'afgekeurd')) {
          vmDocs++;
        }
      });
      let vmNurses = 0;
      nurses.forEach(nurse => {
        const status = getSlotStatus(nurse, d.dayKey, d.dateStr, 'vm');
        if (status.isScheduled && (!status.leaveRequest || status.leaveRequest.status === 'afgekeurd')) {
          vmNurses++;
        }
      });
      const vmShortage = vmDocs > vmNurses;

      // NM
      let nmDocs = 0;
      doctors.forEach(doc => {
        const status = getSlotStatus(doc, d.dayKey, d.dateStr, 'nm');
        if (status.isScheduled && (!status.leaveRequest || status.leaveRequest.status === 'afgekeurd')) {
          nmDocs++;
        }
      });
      let nmNurses = 0;
      nurses.forEach(nurse => {
        const status = getSlotStatus(nurse, d.dayKey, d.dateStr, 'nm');
        if (status.isScheduled && (!status.leaveRequest || status.leaveRequest.status === 'afgekeurd')) {
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

  // Overall counts for badges & summary
  const pendingCount = useMemo(
    () => leaveRequests.filter(r => r.status === 'aangevraagd').length,
    [leaveRequests]
  );
  const onHoldCount = useMemo(
    () => leaveRequests.filter(r => r.status === 'on_hold').length,
    [leaveRequests]
  );
  const approvedCount = useMemo(
    () => leaveRequests.filter(r => r.status === 'goedgekeurd').length,
    [leaveRequests]
  );
  const rejectedCount = useMemo(
    () => leaveRequests.filter(r => r.status === 'afgekeurd').length,
    [leaveRequests]
  );

  // Week-specific pending count
  const weekPendingRequests = useMemo(() => {
    const weekDates = new Set(weekInfo.days.map(d => d.dateStr));
    return leaveRequests.filter(r => weekDates.has(r.date) && r.status === 'aangevraagd');
  }, [leaveRequests, weekInfo.days]);

  // Open Approval Modal
  const handleOpenApprovalModal = (
    staff: StaffMember,
    dayKey: DayOfWeekKey,
    dateStr: string,
    slot: LeaveSlot,
    dayLabel: string,
    formattedDate: string
  ) => {
    const daySchedule = staff.schedule?.[dayKey] || { vm: false, nm: false };
    const slotLower = slot === 'HELE_DAG' ? 'vm' : (slot.toLowerCase() as 'vm' | 'nm');
    const status = getSlotStatus(staff, dayKey, dateStr, slotLower);

    setActiveApprovalSlot({
      staff,
      dateStr,
      dayKey,
      slot,
      leaveRequest: status.leaveRequest,
      rawLeaveRequest: status.rawLeaveRequest,
      daySchedule,
      dayLabel,
      formattedDate
    });

    // Populate initial inputs for note, todo & day comment
    setModalNoteText(status.leaveRequest?.note || '');
    setModalTodoTitle(`Vervanging opvolgen voor ${staff.name} op ${dayLabel} ${dateStr} (${slot})`);
    setModalTodoDeadline(dateStr);
    setModalDayCommentText(`[${dayLabel} ${formattedDate}] Verlofbeoordeling ${staff.name}: `);
    setModalCommentAuthorId(staffList[0]?.id || '');
    setModalFeedback(null);
  };

  // Open Day Action Modal (clicking column header)
  const handleOpenDayActionModal = (dateStr: string, dayLabel: string, formattedDate: string) => {
    setActiveDayAction({
      dateStr,
      dayLabel,
      formattedDate
    });
    setDayCommentText(`[${dayLabel} ${formattedDate}] `);
    setDayCommentAuthorId(staffList[0]?.id || '');
    setDayTodoTitle(`Actie voor ${dayLabel} ${formattedDate}: `);
    setDayModalFeedback(null);
  };

  // Modal Handlers: FAST SYNCHRONOUS CLOSE OR CONFIRMATION
  const handleApproveStatus = (status: LeaveStatus) => {
    if (!activeApprovalSlot?.leaveRequest) return;
    const reqId = activeApprovalSlot.leaveRequest.id;
    const note = modalNoteText.trim() || undefined;

    // Optimistically trigger
    onUpdateStatus(reqId, status, note).catch(err =>
      console.warn('Update leave status error:', err)
    );

    // Close modal immediately
    setActiveApprovalSlot(null);
  };

  const handleSaveNoteOnly = () => {
    if (!activeApprovalSlot?.leaveRequest) return;
    const reqId = activeApprovalSlot.leaveRequest.id;
    const note = modalNoteText.trim();

    if (onUpdateNote) {
      onUpdateNote(reqId, note).catch(err => console.warn('Update note error:', err));
    } else {
      onUpdateStatus(reqId, activeApprovalSlot.leaveRequest.status, note).catch(err =>
        console.warn('Update note via status error:', err)
      );
    }
    setModalFeedback('Opmerking bij aanvraag opgeslagen!');
    setTimeout(() => setModalFeedback(null), 2500);
  };

  const handleAddTodoFromModal = async () => {
    if (!modalTodoTitle.trim() || !onAddTodo) return;

    await onAddTodo({
      title: modalTodoTitle.trim(),
      deadline: modalTodoDeadline || undefined,
      is_completed: false,
      archived: false
    });

    setModalFeedback('To Do taak direct toegevoegd aan takenlijst bovenaan!');
    setTimeout(() => setModalFeedback(null), 3000);
  };

  const handleAddDayCommentFromModal = async () => {
    if (!modalDayCommentText.trim() || !onAddComment) return;

    const author = staffList.find(s => s.id === modalCommentAuthorId);
    await onAddComment({
      week_identifier: weekInfo.identifier,
      author_id: modalCommentAuthorId,
      author_name: author ? author.name : 'Coördinator',
      message: modalDayCommentText.trim()
    });

    setModalFeedback('Commentaar geplaatst in Algemene Opmerkingen!');
    setTimeout(() => setModalFeedback(null), 3000);
  };

  const handleDeleteRequestFromModal = () => {
    if (!activeApprovalSlot?.leaveRequest) return;
    if (!window.confirm('Weet u zeker dat u deze verlofaanvraag wilt verwijderen?')) return;

    const reqId = activeApprovalSlot.leaveRequest.id;
    setActiveApprovalSlot(null);
    onDeleteRequest(reqId).catch(err => console.warn('Delete leave request error:', err));
  };

  // Day Action Modal submit handlers
  const handleSaveDayComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayCommentText.trim() || !onAddComment || !activeDayAction) return;

    const author = staffList.find(s => s.id === dayCommentAuthorId);
    await onAddComment({
      week_identifier: weekInfo.identifier,
      author_id: dayCommentAuthorId,
      author_name: author ? author.name : 'Coördinator',
      message: dayCommentText.trim()
    });
    setDayModalFeedback('Opmerking succesvol geplaatst in het weekoverzicht!');
    setTimeout(() => {
      setDayModalFeedback(null);
      setActiveDayAction(null);
    }, 1200);
  };

  const handleSaveDayTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dayTodoTitle.trim() || !onAddTodo || !activeDayAction) return;

    await onAddTodo({
      title: dayTodoTitle.trim(),
      deadline: activeDayAction.dateStr,
      is_completed: false,
      archived: false
    });
    setDayModalFeedback('To Do taak succesvol toegevoegd aan de takenlijst!');
    setTimeout(() => {
      setDayModalFeedback(null);
      setActiveDayAction(null);
    }, 1200);
  };

  // Batch approve current week
  const handleApproveAllInCurrentWeek = async () => {
    if (weekPendingRequests.length === 0) return;
    if (
      !window.confirm(
        `Wilt u alle ${weekPendingRequests.length} openstaande aanvragen voor Week ${weekInfo.weekNumber} direct goedkeuren?`
      )
    ) {
      return;
    }

    for (const req of weekPendingRequests) {
      await onUpdateStatus(req.id, 'goedgekeurd');
    }
  };

  // Direct one-click approve & reject right from the week schedule grid
  const handleDirectApprove = async (requestId: string) => {
    try {
      await onUpdateStatus(requestId, 'goedgekeurd');
    } catch (err) {
      console.error('Fout bij direct goedkeuren van verlofaanvraag:', err);
    }
  };

  const handleDirectReject = async (requestId: string) => {
    try {
      await onUpdateStatus(requestId, 'afgekeurd');
    } catch (err) {
      console.error('Fout bij direct afkeuren van verlofaanvraag:', err);
    }
  };

  // Filtered requests for the wachtrij view
  const filteredQueueRequests = useMemo(() => {
    return leaveRequests
      .filter(r => {
        if (filterStatus !== 'all' && r.status !== filterStatus) return false;
        const staff = findMatchingStaff(staffList, r.staff_id, r.staff_name);
        if (filterRole !== 'all' && staff?.role !== filterRole) return false;
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const nameMatch = (r.staff_name || staff?.name || '').toLowerCase().includes(term);
          const dateMatch = r.date.includes(term);
          return nameMatch || dateMatch;
        }
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [leaveRequests, staffList, filterStatus, filterRole, searchTerm]);

  return (
    <div className="space-y-6">
      {/* ========================================================================= */}
      {/* 1. BOVENSTE RIJ: ALGEMENE OPMERKINGEN (LINKS) & TO DO LIJST (RECHTS) */}
      {/* Herhaald uit het weekoverzicht conform gebruikerswens */}
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
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">
              {currentWeekComments.length} berichten
            </span>
          </div>

          {/* Feed */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
            {currentWeekComments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 text-slate-400">
                <MessageSquare className="w-7 h-7 stroke-1 text-slate-300 mb-1.5" />
                <p className="text-xs font-medium">Nog geen opmerkingen voor {weekInfo.identifier}.</p>
                <p className="text-[10px] text-slate-400">Plaats hieronder een mededeling of afspraak.</p>
              </div>
            ) : (
              currentWeekComments.map(comment => {
                const author = staffList.find(s => s.id === comment.author_id);
                const roleBadge = author?.role === 'arts' ? 'Arts' : 'Verpleegkundige';
                const roleColor =
                  author?.role === 'arts'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200';
                const timeStr = new Date(comment.created_at).toLocaleDateString('nl-BE', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={comment.id}
                    className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/70 hover:bg-slate-50 transition group"
                  >
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
                        {onDeleteComment && (
                          <button
                            type="button"
                            onClick={() => onDeleteComment(comment.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition p-0.5 cursor-pointer"
                            title="Opmerking verwijderen"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
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

          {/* New Comment Form */}
          <form
            onSubmit={handlePostComment}
            className="p-3 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl space-y-2 shrink-0"
          >
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
                  const isOverdue =
                    hasDeadline && new Date(todo.deadline!).getTime() < Date.now() - 86400000;

                  return (
                    <div
                      key={todo.id}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-teal-300 hover:shadow-xs transition flex items-start justify-between gap-2.5 group"
                    >
                      <div className="flex items-start gap-2.5 flex-1 min-w-0">
                        {onToggleTodo && (
                          <button
                            type="button"
                            onClick={() => onToggleTodo(todo.id, false)}
                            className="w-4.5 h-4.5 rounded border border-slate-300 hover:border-teal-600 hover:bg-teal-50 flex items-center justify-center transition cursor-pointer shrink-0 text-white hover:text-teal-600 mt-0.5"
                            title="Afvinken en archiveren"
                          >
                            <Check className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                          </button>
                        )}
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
                      {onDeleteTodo && (
                        <button
                          type="button"
                          onClick={() => onDeleteTodo(todo.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500 transition p-0.5 cursor-pointer shrink-0 mt-0.5"
                          title="Verwijderen"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )
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
                      {onDeleteTodo && (
                        <button
                          type="button"
                          onClick={() => onDeleteTodo(todo.id)}
                          className="text-slate-400 hover:text-red-600 transition p-0.5 cursor-pointer"
                          title="Wissen"
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

          {/* Add Todo Form */}
          {!showArchive && (
            <form
              onSubmit={handlePostTodo}
              className="p-3 border-t border-slate-100 bg-slate-50/70 rounded-b-2xl space-y-2 shrink-0"
            >
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
      {/* 2. VERLOF GOEDKEUREN ROOSTER NAVIGATIEBALK */}
      {/* Identieke layout met extra status indicatoren en weergave-opties */}
      {/* ========================================================================= */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-4">
        {/* Navigation & Title */}
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
              Week {weekInfo.weekNumber}{' '}
              <span className="text-slate-500 font-normal text-sm">({weekInfo.formattedRange})</span>
            </span>
          </div>
        </div>

        {/* View Switcher & Approval Quick Counts */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Quick status chips */}
          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs">
            <span
              className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 ${
                pendingCount > 0 ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'text-slate-600'
              }`}
              title="Aanvragen wachtend op goedkeuring"
            >
              <Clock className="w-3 h-3 text-amber-600" />
              {pendingCount} Wachtend
            </span>

            <span
              className={`px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 ${
                onHoldCount > 0 ? 'bg-purple-100 text-purple-900 border border-purple-300' : 'text-slate-600'
              }`}
              title="Aanvragen in beraad / on hold"
            >
              <PauseCircle className="w-3 h-3 text-purple-600" />
              {onHoldCount} On Hold
            </span>

            <span
              className="px-2 py-0.5 rounded-lg font-bold flex items-center gap-1 text-emerald-800 bg-emerald-50 border border-emerald-200"
              title="Reeds goedgekeurde verlofaanvragen"
            >
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              {approvedCount} Goedgekeurd
            </span>
          </div>

          {/* Batch Approve Week */}
          {weekPendingRequests.length > 0 && (
            <button
              type="button"
              onClick={handleApproveAllInCurrentWeek}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={`Keur alle ${weekPendingRequests.length} aanvragen van Week ${weekInfo.weekNumber} goed`}
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Keur Week {weekInfo.weekNumber} Goed ({weekPendingRequests.length})</span>
            </button>
          )}

          {/* Weergave Toggle: Weekrooster vs Wachtrij Lijst */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('rooster')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'rooster' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              Weekrooster
            </button>
            <button
              type="button"
              onClick={() => setViewMode('wachtrij')}
              className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'wachtrij' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Wachtrij Lijst
              {pendingCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-400 text-amber-950">
                  {pendingCount}
                </span>
              )}
            </button>
          </div>

          {/* Datepicker Jump */}
          <div className="flex items-center gap-2 border-l border-slate-200 pl-3">
            <span className="text-xs text-slate-500 font-semibold">Spring naar:</span>
            <input
              type="date"
              onChange={handleJumpToDate}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ROOSTER WEERGAVE (IDENTIEK AAN WEEKOVERZICHT MET DIRECTE GOEDKEUR-ACTIES) */}
      {/* ========================================================================= */}
      {viewMode === 'rooster' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table Legend (Identiek aan Weekoverzicht) */}
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
                <span className="w-3 h-3 rounded bg-indigo-100 border border-indigo-300"></span>
                <span className="text-slate-600 text-[11px]">Verlof (Goedgekeurd)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-50 border-2 border-dashed border-amber-400"></span>
                <span className="text-slate-600 text-[11px]">Verplicht (In Aanvraag)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-amber-100 border border-amber-300"></span>
                <span className="text-slate-600 text-[11px]">Verplicht (Goedgekeurd)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded bg-red-50 border border-red-300"></span>
                <span className="text-slate-600 text-[11px]">Afgekeurd</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium">
              <span>💡 <strong>Rechtstreeks goed- of afkeuren:</strong> klik op ✓ of ✕ in het vakje, of klik op het vakje voor alle opties</span>
            </div>
          </div>

          {/* Matrix Table */}
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
                        className={`p-2 text-center border-l transition-colors ${
                          hasShortage
                            ? 'bg-red-600 text-white border-red-700 shadow-inner'
                            : 'bg-slate-100/90 text-slate-800 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1">
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
                          <div className="mt-0.5 inline-block px-1.5 py-0.2 bg-red-800/90 text-white rounded text-[9px] font-black tracking-tight">
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
                    const vmShortage = dayStat?.vm?.isShortage;
                    const nmShortage = dayStat?.nm?.isShortage;

                    return (
                      <React.Fragment key={`sub-${d.dateStr}`}>
                        {/* VM Header */}
                        <th
                          className={`p-1 border-l w-[8.7%] min-w-[48px] transition-colors ${
                            vmShortage
                              ? 'bg-red-500 text-white font-black border-red-600'
                              : 'bg-slate-50/90 text-slate-600 border-slate-200'
                          }`}
                          title={
                            vmShortage
                              ? `⚠️ TEKORT: ${dayStat?.vm?.doctors} artsen vs ${dayStat?.vm?.nurses} verpleegkundigen!`
                              : `VM bezetting: ${dayStat?.vm?.doctors} artsen en ${dayStat?.vm?.nurses} verpleegkundigen`
                          }
                        >
                          VM
                          {vmShortage && (
                            <span className="block text-[8px] leading-none font-bold text-yellow-200 mt-0.5">
                              {dayStat?.vm?.doctors}A vs {dayStat?.vm?.nurses}V
                            </span>
                          )}
                        </th>

                        {/* NM Header */}
                        <th
                          className={`p-1 border-l w-[8.7%] min-w-[48px] transition-colors ${
                            nmShortage
                              ? 'bg-red-500 text-white font-black border-red-600'
                              : 'bg-slate-50/90 text-slate-600 border-slate-100'
                          }`}
                          title={
                            nmShortage
                              ? `⚠️ TEKORT: ${dayStat?.nm?.doctors} artsen vs ${dayStat?.nm?.nurses} verpleegkundigen!`
                              : `NM bezetting: ${dayStat?.nm?.doctors} artsen en ${dayStat?.nm?.nurses} verpleegkundigen`
                          }
                        >
                          NM
                          {nmShortage && (
                            <span className="block text-[8px] leading-none font-bold text-yellow-200 mt-0.5">
                              {dayStat?.nm?.doctors}A vs {dayStat?.nm?.nurses}V
                            </span>
                          )}
                        </th>
                      </React.Fragment>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 text-xs">
                {/* ------------------------------------------------------------- */}
                {/* SECTIE 1: ARTSEN */}
                {/* ------------------------------------------------------------- */}
                <tr className="bg-blue-50/50 font-extrabold text-blue-900 border-t border-b border-blue-100">
                  <td colSpan={11} className="py-2 px-3 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    Artsen (Dokters) — ({doctors.length})
                  </td>
                </tr>

                {doctors.map(doctor => (
                  <tr key={doctor.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-2 w-[130px] min-w-[120px] max-w-[135px] sticky left-0 z-10 bg-white border-r border-slate-200 shadow-xs">
                      <div className="font-bold text-slate-800 text-xs truncate" title={doctor.name}>
                        {doctor.name}
                      </div>
                      <span className="text-[10px] text-blue-600 font-semibold">Arts</span>
                    </td>

                    {weekInfo.days.map(d => {
                      const vmStatus = getSlotStatus(doctor, d.dayKey, d.dateStr, 'vm');
                      const nmStatus = getSlotStatus(doctor, d.dayKey, d.dateStr, 'nm');

                      return (
                        <React.Fragment key={`${doctor.id}-${d.dateStr}`}>
                          {/* VM CELL */}
                          <td className="p-1 border-l border-slate-200 text-center align-middle">
                            <ApprovalScheduleSlotCell
                              status={vmStatus}
                              staff={doctor}
                              onDirectApprove={handleDirectApprove}
                              onDirectReject={handleDirectReject}
                              onClick={() =>
                                handleOpenApprovalModal(
                                  doctor,
                                  d.dayKey,
                                  d.dateStr,
                                  vmStatus.leaveRequest?.slot === 'HELE_DAG' ? 'HELE_DAG' : 'VM',
                                  d.label,
                                  d.formattedDate
                                )
                              }
                            />
                          </td>

                          {/* NM CELL */}
                          <td className="p-1 border-l border-slate-100 text-center align-middle">
                            <ApprovalScheduleSlotCell
                              status={nmStatus}
                              staff={doctor}
                              onDirectApprove={handleDirectApprove}
                              onDirectReject={handleDirectReject}
                              onClick={() =>
                                handleOpenApprovalModal(
                                  doctor,
                                  d.dayKey,
                                  d.dateStr,
                                  nmStatus.leaveRequest?.slot === 'HELE_DAG' ? 'HELE_DAG' : 'NM',
                                  d.label,
                                  d.formattedDate
                                )
                              }
                            />
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                ))}

                {/* ------------------------------------------------------------- */}
                {/* SECTIE 2: VERPLEEGKUNDIGEN */}
                {/* ------------------------------------------------------------- */}
                <tr className="bg-emerald-50/50 font-extrabold text-emerald-900 border-t border-b border-emerald-100">
                  <td colSpan={11} className="py-2 px-3 text-xs flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    Verpleegkundigen — ({nurses.length})
                  </td>
                </tr>

                {nurses.map(nurse => (
                  <tr key={nurse.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-2 w-[130px] min-w-[120px] max-w-[135px] sticky left-0 z-10 bg-white border-r border-slate-200 shadow-xs">
                      <div className="font-bold text-slate-800 text-xs truncate" title={nurse.name}>
                        {nurse.name}
                      </div>
                      <span className="text-[10px] text-emerald-600 font-semibold">Verpleegkundige</span>
                    </td>

                    {weekInfo.days.map(d => {
                      const vmStatus = getSlotStatus(nurse, d.dayKey, d.dateStr, 'vm');
                      const nmStatus = getSlotStatus(nurse, d.dayKey, d.dateStr, 'nm');

                      return (
                        <React.Fragment key={`${nurse.id}-${d.dateStr}`}>
                          {/* VM CELL */}
                          <td className="p-1 border-l border-slate-200 text-center align-middle">
                            <ApprovalScheduleSlotCell
                              status={vmStatus}
                              staff={nurse}
                              onDirectApprove={handleDirectApprove}
                              onDirectReject={handleDirectReject}
                              onClick={() =>
                                handleOpenApprovalModal(
                                  nurse,
                                  d.dayKey,
                                  d.dateStr,
                                  vmStatus.leaveRequest?.slot === 'HELE_DAG' ? 'HELE_DAG' : 'VM',
                                  d.label,
                                  d.formattedDate
                                )
                              }
                            />
                          </td>

                          {/* NM CELL */}
                          <td className="p-1 border-l border-slate-100 text-center align-middle">
                            <ApprovalScheduleSlotCell
                              status={nmStatus}
                              staff={nurse}
                              onDirectApprove={handleDirectApprove}
                              onDirectReject={handleDirectReject}
                              onClick={() =>
                                handleOpenApprovalModal(
                                  nurse,
                                  d.dayKey,
                                  d.dateStr,
                                  nmStatus.leaveRequest?.slot === 'HELE_DAG' ? 'HELE_DAG' : 'NM',
                                  d.label,
                                  d.formattedDate
                                )
                              }
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
      )}

      {/* ========================================================================= */}
      {/* 4. WACHTRIJ LIJST WEERGAVE (ALTERNATIVE COMPACT LIST) */}
      {/* ========================================================================= */}
      {viewMode === 'wachtrij' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 space-y-4">
          {/* Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Quick Status Pill Tabs */}
              <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => setFilterStatus('aangevraagd')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'aangevraagd'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <span>Wachtrij</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    filterStatus === 'aangevraagd' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {pendingCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatus('goedgekeurd')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'goedgekeurd'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <span>Goedgekeurd</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    filterStatus === 'goedgekeurd' ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {approvedCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatus('on_hold')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'on_hold'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <span>On Hold</span>
                  {onHoldCount > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      filterStatus === 'on_hold' ? 'bg-purple-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {onHoldCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatus('afgekeurd')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'afgekeurd'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <span>Afgekeurd</span>
                  {rejectedCount > 0 && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      filterStatus === 'afgekeurd' ? 'bg-red-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {rejectedCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setFilterStatus('all')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    filterStatus === 'all'
                      ? 'bg-slate-800 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
                  }`}
                >
                  <span>Alle</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    filterStatus === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {leaveRequests.length}
                  </span>
                </button>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Zoek medewerker of datum..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                />
              </div>

              {/* Role Filter */}
              <select
                value={filterRole}
                onChange={e => setFilterRole(e.target.value)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Alle Rollen</option>
                <option value="arts">Artsen</option>
                <option value="verpleegkundige">Verpleegkundigen</option>
              </select>
            </div>

            {/* Batch approve all overall */}
            {onBatchApproveAllPending && pendingCount > 0 && (
              <button
                type="button"
                onClick={onBatchApproveAllPending}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>Alles Goedkeuren ({pendingCount})</span>
              </button>
            )}
          </div>

          {/* Queue List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 text-slate-600 font-bold border-b border-slate-200">
                  <th className="p-3">Medewerker</th>
                  <th className="p-3">Datum & Dagdeel</th>
                  <th className="p-3">Type & Dagen</th>
                  <th className="p-3">Huidige Status</th>
                  <th className="p-3">Planner Opmerking / To Do</th>
                  <th className="p-3 text-right">Acties</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredQueueRequests.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 px-4 text-center">
                      <div className="flex flex-col items-center justify-center space-y-2 max-w-sm mx-auto">
                        <div className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-base shadow-xs">
                          ✓
                        </div>
                        <p className="font-semibold text-slate-800 text-sm">
                          {filterStatus === 'aangevraagd'
                            ? 'Geen openstaande aanvragen in de wachtrij'
                            : 'Geen verlofaanvragen gevonden'}
                        </p>
                        <p className="text-slate-500 text-xs">
                          {filterStatus === 'aangevraagd'
                            ? 'Alle verlofaanvragen zijn goedgekeurd of verwerkt.'
                            : 'Er zijn geen verloven gevonden die voldoen aan de huidige zoekfilters.'}
                        </p>
                        {filterStatus !== 'all' && leaveRequests.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setFilterStatus('all')}
                            className="mt-2 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                          >
                            Toon alle verloven ({leaveRequests.length})
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredQueueRequests.map(r => {
                    const staff = findMatchingStaff(staffList, r.staff_id, r.staff_name);

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-slate-900">{r.staff_name || staff?.name}</div>
                          <span className="text-[10px] text-slate-500 capitalize">{staff?.role || 'Personeel'}</span>
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-800">{r.date}</div>
                          <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-slate-100 text-slate-700">
                            {r.slot === 'HELE_DAG' ? 'Volledige Dag' : r.slot}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.type === 'gecompenseerd'
                                ? 'bg-teal-50 text-teal-800 border border-teal-300'
                                : r.type === 'verplicht'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-blue-50 text-blue-800 border border-blue-200'
                            }`}
                          >
                            {r.type === 'gecompenseerd'
                              ? `Gecompenseerd (-${r.units}d)`
                              : r.type === 'verplicht'
                              ? `Verplicht verlof (+${r.units}d)`
                              : `Regulier (${r.units}d)`}
                          </span>
                        </td>
                        <td className="p-3">
                          {r.status === 'aangevraagd' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              ⏳ In Aanvraag
                            </span>
                          )}
                          {r.status === 'on_hold' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-900 border border-purple-300">
                              ⏸️ On Hold
                            </span>
                          )}
                          {r.status === 'goedgekeurd' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                              ✓ Goedgekeurd
                            </span>
                          )}
                          {r.status === 'afgekeurd' && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-900 border border-red-300">
                              ✕ Afgekeurd
                            </span>
                          )}
                        </td>
                        <td className="p-3">
                          {r.note ? (
                            <p className="text-[11px] text-slate-700 max-w-xs bg-slate-50 p-1.5 rounded border border-slate-200">
                              📝 {r.note}
                            </p>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">Geen opmerking</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {r.status !== 'goedgekeurd' && (
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(r.id, 'goedgekeurd')}
                                className="p-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200 font-bold transition cursor-pointer"
                                title="Goedkeuren"
                              >
                                Goedkeuren
                              </button>
                            )}
                            {r.status !== 'on_hold' && (
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(r.id, 'on_hold')}
                                className="p-1.5 text-xs bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg border border-purple-200 font-bold transition cursor-pointer"
                                title="On Hold zetten"
                              >
                                On Hold
                              </button>
                            )}
                            {r.status !== 'afgekeurd' && (
                              <button
                                type="button"
                                onClick={() => onUpdateStatus(r.id, 'afgekeurd')}
                                className="p-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded-lg border border-red-200 font-bold transition cursor-pointer"
                                title="Afkeuren"
                              >
                                Afkeuren
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm('Verlofaanvraag verwijderen?')) {
                                  onDeleteRequest(r.id);
                                }
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer"
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
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL: VERLOF GOEDKEUREN & PLANNING ACTIES (INSTANT SLUITEND) */}
      {/* ========================================================================= */}
      {activeApprovalSlot && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setActiveApprovalSlot(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden text-slate-800"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Verlof Goedkeuring & Acties
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {activeApprovalSlot.staff.name} • {activeApprovalSlot.dayLabel}{' '}
                    {activeApprovalSlot.formattedDate} ({activeApprovalSlot.slot})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveApprovalSlot(null)}
                className="p-1.5 rounded-lg hover:bg-slate-200/70 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Feedback Alert */}
            {modalFeedback && (
              <div className="p-2.5 mx-4 mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{modalFeedback}</span>
              </div>
            )}

            {/* Modal Body */}
            <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
              {/* SECTIE A: GOEDKEUR & STATUS ACTIES (indien aanvraag bestaat) */}
              {activeApprovalSlot.leaveRequest ? (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                        Huidige Status
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        {activeApprovalSlot.leaveRequest.status === 'aangevraagd' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> In Aanvraag
                          </span>
                        )}
                        {activeApprovalSlot.leaveRequest.status === 'on_hold' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-purple-100 text-purple-900 border border-purple-300 flex items-center gap-1">
                            <PauseCircle className="w-3 h-3" /> On Hold / In Beraad
                          </span>
                        )}
                        {activeApprovalSlot.leaveRequest.status === 'goedgekeurd' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Goedgekeurd
                          </span>
                        )}
                        {activeApprovalSlot.leaveRequest.status === 'afgekeurd' && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-red-100 text-red-900 border border-red-300 flex items-center gap-1">
                            ✕ Afgekeurd
                          </span>
                        )}

                        <span className="text-xs font-bold text-slate-600">
                          {activeApprovalSlot.leaveRequest.type === 'gecompenseerd'
                            ? 'Gecompenseerde werkdag'
                            : activeApprovalSlot.leaveRequest.type === 'verplicht'
                            ? 'Verplicht verlof'
                            : 'Regulier'}{' '}
                          ({activeApprovalSlot.leaveRequest.type === 'gecompenseerd' ? '-' : ''}
                          {activeApprovalSlot.leaveRequest.units}d)
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleDeleteRequestFromModal}
                      className="p-1.5 text-slate-400 hover:text-red-600 transition cursor-pointer rounded-lg hover:bg-red-50"
                      title="Verwijder verlofaanvraag"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Primary Decision Action Buttons */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleApproveStatus('goedgekeurd')}
                      className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition flex flex-col items-center justify-center gap-1 cursor-pointer shadow-xs"
                    >
                      <Check className="w-4 h-4" />
                      <span>Goedkeuren</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApproveStatus('on_hold')}
                      className="py-2.5 px-3 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl transition flex flex-col items-center justify-center gap-1 cursor-pointer shadow-xs"
                    >
                      <PauseCircle className="w-4 h-4" />
                      <span>On Hold Zetten</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApproveStatus('afgekeurd')}
                      className="py-2.5 px-3 bg-white hover:bg-red-50 text-red-700 border border-red-200 font-extrabold text-xs rounded-xl transition flex flex-col items-center justify-center gap-1 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                      <span>Afkeuren</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Rooster Status
                  </span>
                  <p className="text-xs font-bold text-slate-700 mt-1">
                    Geen actieve verlofaanvraag op dit dagdeel. Medewerker staat ingeroosterd of is vrij.
                  </p>
                </div>
              )}

              {/* SECTIE B: COMMENTAAR / NOTITIE PLAKKEN BIJ DEZE AANVRAAG */}
              {activeApprovalSlot.leaveRequest && (
                <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Commentaar bij deze aanvraag plakken</span>
                    </label>
                    <span className="text-[10px] text-slate-400">Zichtbaar bij aanvraag</span>
                  </div>
                  <textarea
                    rows={2}
                    value={modalNoteText}
                    onChange={e => setModalNoteText(e.target.value)}
                    placeholder="Bv. 'Onder voorbehoud van vervanging door Karina', 'Besproken op teamoverleg'..."
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveNoteOnly}
                      className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Commentaar bij aanvraag opslaan</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SECTIE C: TO DO TAAK PLAKKEN IN DE TAKENLIJST */}
              <div className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-teal-600" />
                    <span>To Do taak plakken (voor deze aanvraag of dag)</span>
                  </label>
                  <span className="text-[10px] text-teal-700">Komt in takenlijst bovenaan</span>
                </div>
                <input
                  type="text"
                  value={modalTodoTitle}
                  onChange={e => setModalTodoTitle(e.target.value)}
                  placeholder="Bv. Vervanging zoeken voor..."
                  className="w-full text-xs bg-white border border-teal-200 rounded-xl px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-white border border-teal-200 rounded-xl px-2.5 py-1 text-xs text-slate-600 flex-1">
                    <span className="text-[11px] font-bold text-slate-400">Deadline:</span>
                    <input
                      type="date"
                      value={modalTodoDeadline}
                      onChange={e => setModalTodoDeadline(e.target.value)}
                      className="text-xs bg-transparent border-0 font-medium text-slate-700 focus:outline-none cursor-pointer py-0 w-full"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleAddTodoFromModal}
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>To Do Toevoegen</span>
                  </button>
                </div>
              </div>

              {/* SECTIE D: COMMENTAAR PLAKKEN VOOR DE GEHELE DAG / WEEK */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Pin className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Commentaar plakken bij de gehele dag / week</span>
                  </label>
                  <span className="text-[10px] text-slate-400">In Algemene Opmerkingen</span>
                </div>
                <input
                  type="text"
                  value={modalDayCommentText}
                  onChange={e => setModalDayCommentText(e.target.value)}
                  placeholder="Bericht voor het weekoverleg..."
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="flex items-center gap-2">
                  <select
                    value={modalCommentAuthorId}
                    onChange={e => setModalCommentAuthorId(e.target.value)}
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none cursor-pointer"
                  >
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.role === 'arts' ? '👨‍⚕️' : '🩺'} {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAddDayCommentFromModal}
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Plaatsen</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveApprovalSlot(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Sluiten
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: DAG-ACTIE (OPMERKING OF TO DO VOOR DE GEHELE DAG) */}
      {/* Geopend via klik op '+ Dag-actie' in de kolomheader */}
      {/* ========================================================================= */}
      {activeDayAction && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150"
          onClick={() => setActiveDayAction(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden text-slate-800"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
                  <Pin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Actie voor {activeDayAction.dayLabel} {activeDayAction.formattedDate}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Plak direct commentaar of een To Do taak voor deze specifieke dag
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDayAction(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {dayModalFeedback && (
              <div className="p-2.5 mx-4 mt-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{dayModalFeedback}</span>
              </div>
            )}

            <div className="p-5 space-y-4">
              {/* Form 1: Algemene Opmerking voor deze dag */}
              <form onSubmit={handleSaveDayComment} className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Commentaar voor deze dag plakken</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Algemene feed</span>
                </div>
                <input
                  type="text"
                  value={dayCommentText}
                  onChange={e => setDayCommentText(e.target.value)}
                  placeholder="Typ opmerking voor deze dag..."
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  required
                />
                <div className="flex items-center gap-2">
                  <select
                    value={dayCommentAuthorId}
                    onChange={e => setDayCommentAuthorId(e.target.value)}
                    className="flex-1 text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 font-medium focus:outline-none cursor-pointer"
                  >
                    {staffList.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.role === 'arts' ? '👨‍⚕️' : '🩺'} {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Plaatsen</span>
                  </button>
                </div>
              </form>

              {/* Form 2: To Do taak voor deze dag */}
              <form onSubmit={handleSaveDayTodo} className="p-3.5 rounded-2xl bg-teal-50/50 border border-teal-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                    <ListTodo className="w-3.5 h-3.5 text-teal-600" />
                    <span>To Do taak voor deze dag plakken</span>
                  </label>
                  <span className="text-[10px] text-teal-700">Takenlijst (deadline ingevuld)</span>
                </div>
                <input
                  type="text"
                  value={dayTodoTitle}
                  onChange={e => setDayTodoTitle(e.target.value)}
                  placeholder="Bv. Extra verpleegkundige oproepen..."
                  className="w-full text-xs bg-white border border-teal-200 rounded-xl px-3 py-2 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-teal-500"
                  required
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>To Do Toevoegen</span>
                  </button>
                </div>
              </form>
            </div>

            <div className="p-3 bg-slate-50/80 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setActiveDayAction(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
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

// =========================================================================
// SUB-COMPONENT: APPROVAL SCHEDULE SLOT CELL IN HET WEEKROOSTER
// (Identiek aan Weekoverzicht + directe 1-klik goedkeur & afkeur acties)
// =========================================================================
interface ApprovalScheduleSlotCellProps {
  status: {
    isScheduled: boolean;
    leaveRequest?: LeaveRequest;
    rawLeaveRequest?: LeaveRequest;
    isOverridden?: boolean;
  };
  staff: StaffMember;
  onDirectApprove: (requestId: string) => void;
  onDirectReject: (requestId: string) => void;
  onClick: () => void;
}

const ApprovalScheduleSlotCell: React.FC<ApprovalScheduleSlotCellProps> = ({
  status,
  staff: _staff,
  onDirectApprove,
  onDirectReject,
  onClick
}) => {
  const { isScheduled, leaveRequest, rawLeaveRequest } = status;
  const req = leaveRequest || rawLeaveRequest;

  // Case 1: Active leave request exists
  if (req) {
    const isApproved = req.status === 'goedgekeurd';
    const isPending = req.status === 'aangevraagd';
    const isOnHold = req.status === 'on_hold';
    const isRejected = req.status === 'afgekeurd';
    const isCompulsory = req.type === 'verplicht';
    const isCompensated = req.type === 'gecompenseerd';

    // 1A. PENDING (In Aanvraag) -> Gestreepte rand + 1-klik Goedkeuren (✓) & Afkeuren (✕)
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
          }. Klik op ✓ om direct goed te keuren, ✕ om af te keuren, of klik op het vakje voor alle opties.`}
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDirectReject(req.id);
              }}
              title="Direct Afkeuren (1-klik)"
              className="w-5 h-5 rounded bg-white hover:bg-red-50 text-red-600 border border-red-300 hover:border-red-400 flex items-center justify-center transition shadow-xs hover:scale-110 cursor-pointer shrink-0"
            >
              <X className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>
        </div>
      );
    }

    // 1B. ON HOLD -> Gestreepte paarse rand + 1-klik Goedkeuren / Afkeuren
    if (isOnHold) {
      return (
        <div
          onClick={onClick}
          title={`On Hold: ${req.type === 'verplicht' ? 'Verplicht' : 'Regulier'} verlof. Klik op ✓ om direct goed te keuren, ✕ om af te keuren, of klik op het vakje voor alle opties.`}
          className="w-full min-h-[44px] rounded-lg p-1 flex flex-col items-center justify-between transition cursor-pointer shadow-2xs group relative border-2 border-dashed bg-purple-50 hover:bg-purple-100/90 border-purple-400 text-purple-950"
        >
          <div className="flex items-center justify-between w-full px-0.5">
            <span className="text-[9px] font-black leading-none truncate text-purple-900">
              On Hold
            </span>
            <PauseCircle className="w-2.5 h-2.5 text-purple-600 shrink-0" />
          </div>

          <div className="flex items-center justify-center gap-1.5 w-full mt-0.5">
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
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDirectReject(req.id);
              }}
              title="Direct Afkeuren (1-klik)"
              className="w-5 h-5 rounded bg-white hover:bg-red-50 text-red-600 border border-red-300 hover:border-red-400 flex items-center justify-center transition shadow-xs hover:scale-110 cursor-pointer shrink-0"
            >
              <X className="w-3 h-3 stroke-[2.5]" />
            </button>
          </div>
        </div>
      );
    }

    // 1C. GOEDGEKEURD -> Solide styling (identiek aan Weekoverzicht)
    if (isApproved) {
      return (
        <div
          onClick={onClick}
          title={`Goedgekeurd ${
            isCompensated
              ? 'Gecompenseerde Werkdag (-0.5d teller)'
              : isCompulsory
              ? 'Verplicht verlof'
              : 'Regulier verlof'
          }. Klik om details te zien of status aan te passen.`}
          className={`w-full min-h-[44px] rounded-lg p-1 flex flex-col items-center justify-center transition cursor-pointer shadow-2xs group relative border ${
            isCompensated
              ? 'bg-teal-100 hover:bg-teal-200/90 border-teal-400 text-teal-950'
              : isCompulsory
              ? 'bg-amber-100 hover:bg-amber-200/90 border-amber-300 text-amber-950'
              : 'bg-indigo-100 hover:bg-indigo-200/90 border-indigo-300 text-indigo-950'
          }`}
        >
          <div className="flex items-center gap-1">
            {isCompensated ? (
              <Briefcase className="w-3 h-3 text-teal-700" />
            ) : isCompulsory ? (
              <Sparkles className="w-3 h-3 text-amber-700" />
            ) : (
              <ShieldCheck className="w-3 h-3 text-indigo-700" />
            )}
            <Check className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
          </div>
          <span className="text-[9px] font-extrabold leading-none mt-0.5">
            {isCompensated ? 'Gecomp.' : isCompulsory ? 'Verpl.' : 'Verlof'}
          </span>

          {/* Snelle actie op hover: direct intrekken / afkeuren */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDirectReject(req.id);
            }}
            title="Verlof intrekken / afkeuren (1-klik)"
            className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 w-4 h-4 rounded-full bg-white text-red-600 border border-red-300 hover:bg-red-50 flex items-center justify-center transition shadow-2xs cursor-pointer z-10"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      );
    }

    // 1D. AFGEKEURD -> Doorgestreept
    if (isRejected) {
      return (
        <div
          onClick={onClick}
          title="Verlof is afgekeurd. Medewerker staat op dienst. Klik om te heropenen of opties te bekijken."
          className="w-full min-h-[44px] rounded-lg p-1 flex flex-col items-center justify-center transition cursor-pointer shadow-2xs group relative border border-red-200 bg-red-50/80 hover:bg-red-100 text-red-700"
        >
          <span className="text-[9px] font-bold leading-none line-through text-red-500">
            Afgekeurd
          </span>
          <span className="text-[8px] font-semibold text-slate-500 mt-0.5">Dienst</span>

          {/* Snelle heropen-knop op hover */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDirectApprove(req.id);
            }}
            title="Direct heropenen en goedkeuren (1-klik)"
            className="opacity-0 group-hover:opacity-100 absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white hover:bg-emerald-700 flex items-center justify-center transition shadow-2xs cursor-pointer z-10"
          >
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </button>
        </div>
      );
    }
  }

  // Case 2: Dienst (Aanwezig) - Identiek aan Weekoverzicht
  if (isScheduled) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Dienst (Aanwezig). Klik om direct verlof toe te kennen, notitie of to-do te plaatsen."
        className="w-full min-h-[44px] rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80 text-emerald-800 flex flex-col items-center justify-center transition cursor-pointer group hover:shadow-2xs p-1"
      >
        <Check className="w-3.5 h-3.5 text-emerald-600 group-hover:scale-110 transition-transform" />
        <span className="text-[9px] font-extrabold leading-none mt-0.5 text-emerald-700">Dienst</span>
      </button>
    );
  }

  // Case 3: Vrij (Niet ingeroosterd) - Identiek aan Weekoverzicht
  return (
    <button
      type="button"
      onClick={onClick}
      title="Vrij (Niet ingeroosterd). Klik om dienst in te plannen of verlof toe te kennen."
      className="w-full min-h-[44px] rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200/80 text-slate-400 hover:text-slate-600 flex flex-col items-center justify-center transition cursor-pointer group p-1"
    >
      <span className="text-[10px] font-medium">— Vrij</span>
    </button>
  );
};
