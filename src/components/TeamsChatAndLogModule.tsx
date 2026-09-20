/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Doctor, TeamsNotification } from '../types';
import {
  MessageSquare,
  Send,
  BellRing,
  Trash2,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Code
} from 'lucide-react';

interface TeamsChatAndLogModuleProps {
  notifications: TeamsNotification[];
  doctors: Doctor[];
  activeStaffName: string;
  teamsWebhookUrl?: string;
  onClearLog: () => void;
  onSendTeamsMessage: (messageText: string, target?: string, payload?: any) => Promise<boolean | void>;
  onOpenConfig?: () => void;
}

type SubView = 'chat' | 'log';
type Urgentie = 'Normaal' | 'Dringend';

export const TeamsChatAndLogModule: React.FC<TeamsChatAndLogModuleProps> = ({
  notifications,
  doctors,
  activeStaffName,
  teamsWebhookUrl,
  onClearLog,
  onSendTeamsMessage,
  onOpenConfig
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeSubView, setActiveSubView] = useState<SubView>('chat');

  // Chat Form State
  const [targetDoctor, setTargetDoctor] = useState<string>('all');
  const [urgency, setUrgency] = useState<Urgentie>('Normaal');
  const [chatMessage, setChatMessage] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Log filter & payload inspector
  const [logFilter, setLogFilter] = useState<'all' | 'chat' | 'aanmelding'>('all');
  const [expandedPayloadId, setExpandedPayloadId] = useState<string | null>(null);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!chatMessage.trim()) return;

    setIsSending(true);
    setFeedback(null);

    const targetLabel = targetDoctor === 'all' 
      ? 'Algemeen Kanaal' 
      : targetDoctor;

    let prefix = '💬 [Balie Bericht]';
    if (urgency === 'Dringend') prefix = '🚨 [DRINGEND BERICHT]';

    const fullMessage = `${prefix} (${activeStaffName}): ${chatMessage.trim()}`;
    const payload = {
      title: `${prefix} voor ${targetLabel}`,
      sender: `${activeStaffName} (Balie)`,
      type: 'Chatbericht',
      category: 'chat',
      urgency,
      Naam: activeStaffName,
      Dokter: targetLabel,
      Tijdstip: new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }),
      Bericht: chatMessage.trim(),
      Kanaal: targetLabel
    };

    try {
      await onSendTeamsMessage(fullMessage, targetDoctor === 'all' ? undefined : targetDoctor, payload);
      setFeedback({
        type: 'success',
        message: `Verzonden naar ${targetLabel}!`
      });
      setChatMessage('');
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Fout: ${err?.message || 'Controleer de webhook configuratie.'}`
      });
    } finally {
      setIsSending(false);
    }
  };

  const filteredNotifications = notifications.filter(notif => {
    if (logFilter === 'chat') {
      return notif.category === 'chat' || notif.payload?.type === 'Chatbericht';
    }
    if (logFilter === 'aanmelding') {
      return notif.category !== 'chat' && notif.payload?.type !== 'Chatbericht';
    }
    return true;
  });

  const chatNotificationsCount = notifications.filter(
    n => n.category === 'chat' || n.payload?.type === 'Chatbericht'
  ).length;

  const isWebhookConfigured = Boolean(teamsWebhookUrl && teamsWebhookUrl.startsWith('http'));

  return (
    <div className="bg-white rounded-xl border border-indigo-100 shadow-2xs overflow-hidden mb-3 transition-all">
      {/* Ultra-compact Header Bar */}
      <div className="bg-slate-900 text-white px-3.5 py-1.5 flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <MessageSquare className="h-3.5 w-3.5" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-white">Teams & Balie Chat</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.2 rounded ${
              isWebhookConfigured 
                ? 'bg-emerald-500/20 text-emerald-300' 
                : 'bg-amber-500/20 text-amber-300'
            }`}>
              {isWebhookConfigured ? '● Live' : '● Simulatie'}
            </span>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-1.5">
          {/* Sub-view switcher */}
          <div className="bg-white/10 p-0.5 rounded-md flex items-center text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveSubView('chat');
                setIsExpanded(true);
              }}
              className={`px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                activeSubView === 'chat' && isExpanded
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <Send className="h-2.5 w-2.5" />
              Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSubView('log');
                setIsExpanded(true);
              }}
              className={`px-2 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${
                activeSubView === 'log' && isExpanded
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <BellRing className="h-2.5 w-2.5" />
              Log ({notifications.length})
            </button>
          </div>

          {/* Toggle Expand/Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-indigo-200 hover:text-white hover:bg-white/10 rounded transition cursor-pointer"
            title={isExpanded ? 'Module inklappen' : 'Module uitklappen'}
          >
            {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Expandable Compact Body */}
      {isExpanded && (
        <div className="p-2 bg-slate-50/70 border-t border-slate-200/60">
          {/* SUB-VIEW 1: LIVE CHAT NAAR TEAMS (Compact single-row toolbar) */}
          {activeSubView === 'chat' && (
            <div className="space-y-1.5">
              {!isWebhookConfigured && (
                <div className="text-[10px] text-amber-800 bg-amber-50 px-2 py-1 rounded border border-amber-200/70 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 truncate">
                    <AlertCircle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                    <span className="truncate">Geen Teams Webhook URL ingesteld in configuratie (berichten gesimuleerd).</span>
                  </div>
                  {onOpenConfig && (
                    <button
                      type="button"
                      onClick={onOpenConfig}
                      className="font-bold underline ml-2 shrink-0 cursor-pointer text-amber-900"
                    >
                      Instellen
                    </button>
                  )}
                </div>
              )}

              {feedback && (
                <div className={`py-1 px-2.5 rounded text-[11px] flex items-center gap-1.5 ${
                  feedback.type === 'success' 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}>
                  {feedback.type === 'success' ? (
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium">{feedback.message}</span>
                </div>
              )}

              <form onSubmit={handleSendMessage} className="flex flex-col sm:flex-row items-center gap-1.5">
                {/* Target Doctor/Channel */}
                <select
                  value={targetDoctor}
                  onChange={(e) => setTargetDoctor(e.target.value)}
                  className="w-full sm:w-44 text-xs py-1 px-2 rounded-lg border border-slate-300 bg-white font-medium shrink-0 focus:outline-none focus:border-indigo-500"
                >
                  <option value="all">📢 Algemeen Teams</option>
                  {doctors.map(dr => (
                    <option key={dr.id} value={dr.name}>
                      👨‍⚕️ {dr.name}
                    </option>
                  ))}
                </select>

                {/* Urgency Toggle Button */}
                <button
                  type="button"
                  onClick={() => setUrgency(urgency === 'Normaal' ? 'Dringend' : 'Normaal')}
                  className={`text-[11px] font-bold py-1 px-2.5 rounded-lg border shrink-0 cursor-pointer transition ${
                    urgency === 'Dringend'
                      ? 'bg-rose-600 text-white border-rose-600'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                  title="Klik om te wisselen tussen Normaal en Dringend"
                >
                  {urgency === 'Dringend' ? '🚨 Dringend' : 'Normaal'}
                </button>

                {/* Message Input */}
                <div className="flex-1 w-full relative">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Typ een snel bericht naar Teams... (Druk op Enter om te verzenden)"
                    className="w-full text-xs py-1 px-2.5 rounded-lg border border-slate-300 bg-white focus:outline-none focus:border-indigo-500 placeholder:text-slate-400"
                  />
                </div>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={isSending || !chatMessage.trim()}
                  className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg px-3 py-1 text-xs flex items-center justify-center gap-1 transition shadow-2xs shrink-0 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSending ? (
                    <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="h-3 w-3" />
                      <span>Verzend</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* SUB-VIEW 2: TEAMS LOGBOEK (Compact list) */}
          {activeSubView === 'log' && (
            <div className="space-y-1.5">
              {/* Filter & Clear Bar */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200/70 pb-1">
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="font-semibold text-slate-600">Filter:</span>
                  <button
                    type="button"
                    onClick={() => setLogFilter('all')}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      logFilter === 'all'
                        ? 'bg-slate-900 text-white font-bold'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    Alles ({notifications.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter('chat')}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      logFilter === 'chat'
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    Chat ({chatNotificationsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogFilter('aanmelding')}
                    className={`px-1.5 py-0.5 rounded cursor-pointer ${
                      logFilter === 'aanmelding'
                        ? 'bg-emerald-600 text-white font-bold'
                        : 'text-slate-600 hover:bg-slate-200/60'
                    }`}
                  >
                    Kiosk ({notifications.length - chatNotificationsCount})
                  </button>
                </div>

                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearLog}
                    className="text-slate-400 hover:text-red-600 text-[10px] flex items-center gap-0.5 cursor-pointer font-medium transition"
                    title="Wis alle meldingen uit het logboek"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>Wissen</span>
                  </button>
                )}
              </div>

              {/* Compact Log List */}
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-3 text-slate-400 text-xs">
                  Geen Teams notificaties gevonden.
                </div>
              ) : (
                <div className="space-y-1 max-h-[160px] overflow-y-auto pr-1">
                  {filteredNotifications.map((notif) => {
                    const isChat = notif.category === 'chat' || notif.payload?.type === 'Chatbericht';
                    const isExpandedPayload = expandedPayloadId === notif.id;

                    return (
                      <div
                        key={notif.id}
                        className={`p-1.5 rounded-lg border text-xs transition ${
                          isChat
                            ? 'bg-indigo-50/40 border-indigo-100'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1.5 truncate">
                            <span className="font-mono text-slate-500 text-[10px] font-bold">
                              {notif.timestamp}
                            </span>
                            {isChat ? (
                              <span className="text-[10px] text-indigo-700 font-semibold truncate flex items-center gap-0.5">
                                <MessageSquare className="h-2.5 w-2.5 shrink-0" />
                                {notif.targetDoctor || 'Algemeen'}
                              </span>
                            ) : (
                              <span className="text-[10px] text-emerald-700 font-semibold truncate flex items-center gap-0.5">
                                <UserCheck className="h-2.5 w-2.5 shrink-0" />
                                {notif.targetDoctor || 'Wachtzaal'}
                              </span>
                            )}
                            <span className="text-slate-700 text-[11px] truncate font-sans">
                              {notif.messagePreview}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0 text-[10px]">
                            <span className={`px-1 py-0.2 rounded font-bold ${
                              notif.status === 'Success'
                                ? 'text-emerald-700 bg-emerald-50'
                                : notif.status === 'Failed'
                                ? 'text-rose-700 bg-rose-50'
                                : 'text-slate-600 bg-slate-100'
                            }`}>
                              {notif.status === 'Success' && 'Live'}
                              {notif.status === 'Failed' && 'Mislukt'}
                              {notif.status === 'Simulated' && 'Simulatie'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setExpandedPayloadId(isExpandedPayload ? null : notif.id)}
                              className="text-slate-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                              title="JSON bekijken"
                            >
                              <Code className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        </div>

                        {isExpandedPayload && (
                          <div className="mt-1 text-[9px] font-mono bg-slate-900 text-slate-200 p-1.5 rounded max-w-full overflow-x-auto select-all">
                            <pre>{JSON.stringify(notif.payload, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
