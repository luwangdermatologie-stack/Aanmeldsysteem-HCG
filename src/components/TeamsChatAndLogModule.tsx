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
  HelpCircle,
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
type Urgentie = 'Normaal' | 'Dringend' | 'Telefoon' | 'Patiënt' | 'Pauze';

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

  // Log filter
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
    if (urgency === 'Telefoon') prefix = '📞 [TELEFOONOPROEP]';
    if (urgency === 'Patiënt') prefix = '🏥 [PATIËNT AAN BALIE]';
    if (urgency === 'Pauze') prefix = '☕ [BALIE MEDEDELING]';

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
        message: `Bericht succesvol verzonden naar ${targetLabel}!`
      });
      setChatMessage('');
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Fout bij verzenden: ${err?.message || 'Controleer de webhook configuratie.'}`
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
    <div className="bg-white rounded-2xl border border-indigo-100 shadow-sm overflow-hidden mb-4 transition-all">
      {/* Header Bar */}
      <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm tracking-tight text-white flex items-center gap-1.5">
                Microsoft Teams & Live Balie Chat
              </h3>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                isWebhookConfigured 
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                  : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
              }`}>
                {isWebhookConfigured ? '✓ Webhook Live' : '⚠️ Simulatiemodus'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Header Controls */}
        <div className="flex items-center gap-2">
          {/* Sub-view switcher */}
          <div className="bg-white/10 p-0.5 rounded-lg flex items-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setActiveSubView('chat');
                setIsExpanded(true);
              }}
              className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                activeSubView === 'chat' && isExpanded
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <Send className="h-3 w-3" />
              Live Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveSubView('log');
                setIsExpanded(true);
              }}
              className={`px-3 py-1 rounded-md transition cursor-pointer flex items-center gap-1.5 ${
                activeSubView === 'log' && isExpanded
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-indigo-200 hover:text-white'
              }`}
            >
              <BellRing className="h-3 w-3" />
              Teams Logboek
              {notifications.length > 0 && (
                <span className="bg-indigo-400 text-slate-950 text-[10px] font-extrabold px-1.5 py-0.2 rounded-full">
                  {notifications.length}
                </span>
              )}
            </button>
          </div>

          {/* Toggle Expand/Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 text-indigo-200 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition cursor-pointer"
            title={isExpanded ? 'Module inklappen' : 'Module uitklappen'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {isExpanded && (
        <div className="p-4 bg-slate-50/50 border-t border-indigo-50">
          
          {/* SUB-VIEW 1: LIVE CHAT NAAR TEAMS */}
          {activeSubView === 'chat' && (
            <div className="space-y-3.5">
              {/* Quick info banner if no webhook */}
              {!isWebhookConfigured && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-2.5 rounded-xl text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      Nog geen Microsoft Teams Webhook URL ingesteld in de configuratie. Berichten worden lokaal gesimuleerd in het logboek.
                    </span>
                  </div>
                  {onOpenConfig && (
                    <button
                      type="button"
                      onClick={onOpenConfig}
                      className="text-amber-900 font-bold underline text-[11px] ml-2 shrink-0 cursor-pointer"
                    >
                      Instellen in Config
                    </button>
                  )}
                </div>
              )}

              {/* Feedback toast banner */}
              {feedback && (
                <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  feedback.type === 'success' 
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' 
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}>
                  {feedback.type === 'success' ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-medium">{feedback.message}</span>
                </div>
              )}

              {/* Chat Input & Target Controls */}
              <form onSubmit={handleSendMessage} className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {/* Target Doctor/Channel */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Bestemming:
                    </label>
                    <select
                      value={targetDoctor}
                      onChange={(e) => setTargetDoctor(e.target.value)}
                      className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="all">📢 Algemeen Teams Kanaal</option>
                      {doctors.map(dr => (
                        <option key={dr.id} value={dr.name}>
                          👨‍⚕️ {dr.name} ({dr.specialty})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Urgency / Category */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Type / Urgentie:
                    </label>
                    <div className="flex gap-1">
                      {(['Normaal', 'Dringend'] as Urgentie[]).map(u => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setUrgency(u)}
                          className={`flex-1 text-[10px] font-bold py-1.5 px-1 rounded-md border transition cursor-pointer ${
                            urgency === u
                              ? u === 'Dringend'
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {u === 'Dringend' && '🚨 '}
                          {u}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Text Message Field */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      rows={2}
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder="Typ uw bericht rechtstreeks naar het Teams kanaal... (Ctrl + Enter om te verzenden)"
                      className="w-full text-xs p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 focus:outline-none focus:border-indigo-500 focus:bg-white resize-none"
                    />
                  </div>
                  
                  <button
                    type="submit"
                    disabled={isSending || !chatMessage.trim()}
                    className="sm:w-36 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-lg px-4 py-2 text-xs flex items-center justify-center gap-1.5 transition shadow-xs cursor-pointer disabled:cursor-not-allowed"
                  >
                    {isSending ? (
                      <>
                        <div className="h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Verzenden...</span>
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        <span>Naar Teams</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* SUB-VIEW 2: TEAMS LOGBOEK & WEBHOOK FEED */}
          {activeSubView === 'log' && (
            <div className="space-y-3">
              {/* Log Action & Filter Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-700">Filter Logboek:</span>
                  <div className="flex gap-1 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setLogFilter('all')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer ${
                        logFilter === 'all'
                          ? 'bg-slate-900 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Alles ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogFilter('chat')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                        logFilter === 'chat'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <MessageSquare className="h-3 w-3" />
                      Balie Chat ({chatNotificationsCount})
                    </button>
                    <button
                      type="button"
                      onClick={() => setLogFilter('aanmelding')}
                      className={`px-2.5 py-1 rounded-md transition cursor-pointer flex items-center gap-1 ${
                        logFilter === 'aanmelding'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <UserCheck className="h-3 w-3" />
                      Kiosk Aanmeldingen ({notifications.length - chatNotificationsCount})
                    </button>
                  </div>
                </div>

                {notifications.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearLog}
                    className="text-slate-400 hover:text-red-600 text-xs flex items-center gap-1 cursor-pointer font-semibold transition"
                    title="Wis alle opgeslagen meldingen uit het logboek"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Log Leegmaken
                  </button>
                )}
              </div>

              {/* Log List */}
              {filteredNotifications.length === 0 ? (
                <div className="text-center p-6 bg-white rounded-xl border border-slate-200 text-slate-400 space-y-1.5">
                  <HelpCircle className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="font-medium text-xs text-slate-600">
                    {logFilter === 'all'
                      ? 'Er zijn nog geen Microsoft Teams notificaties of chatberichten verzonden.'
                      : 'Geen meldingen gevonden voor dit filter.'}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Gebruik het tabblad &quot;Live Chat&quot; hierboven om een bericht te sturen, of meld een patiënt aan via de kiosk.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
                  {filteredNotifications.map((notif) => {
                    const isChat = notif.category === 'chat' || notif.payload?.type === 'Chatbericht';
                    const isExpandedPayload = expandedPayloadId === notif.id;

                    return (
                      <div
                        key={notif.id}
                        className={`p-3 rounded-xl border transition text-xs ${
                          isChat
                            ? 'bg-indigo-50/40 border-indigo-100'
                            : 'bg-white border-slate-200'
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 mb-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                              {notif.timestamp}
                            </span>

                            {isChat ? (
                              <span className="font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-[10px] border border-indigo-200 flex items-center gap-1">
                                <MessageSquare className="h-2.5 w-2.5" />
                                Chatbericht: {notif.targetDoctor || 'Algemeen Kanaal'}
                              </span>
                            ) : (
                              <span className="font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-[10px] border border-emerald-200 flex items-center gap-1">
                                <UserCheck className="h-2.5 w-2.5" />
                                Kiosk Aanmelding: {notif.targetDoctor || 'Wachtzaal'}
                              </span>
                            )}

                            {notif.sender && (
                              <span className="text-slate-500 text-[10px]">
                                van <strong>{notif.sender}</strong>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              notif.status === 'Success'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : notif.status === 'Failed'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}>
                              {notif.status === 'Success' && '✓ HTTP 200 Live'}
                              {notif.status === 'Failed' && '✗ Verzending Mislukt'}
                              {notif.status === 'Simulated' && 'ℹ️ Gesimuleerd'}
                            </span>

                            <button
                              type="button"
                              onClick={() => setExpandedPayloadId(isExpandedPayload ? null : notif.id)}
                              className="text-[10px] font-mono text-indigo-600 hover:text-indigo-800 flex items-center gap-0.5 cursor-pointer"
                              title="Bekijk JSON payload"
                            >
                              <Code className="h-3 w-3" />
                              {isExpandedPayload ? 'Verberg JSON' : 'JSON'}
                            </button>
                          </div>
                        </div>

                        {/* Message Preview */}
                        <div className="text-slate-800 leading-relaxed select-all border-l-3 border-indigo-400 pl-2.5 py-1 bg-white rounded-md shadow-2xs text-[11px] font-sans">
                          {notif.messagePreview}
                        </div>

                        {/* Collapsible JSON Payload Inspector */}
                        {isExpandedPayload && (
                          <div className="mt-2 text-[10px] font-mono bg-slate-900 text-slate-200 p-2.5 rounded-lg max-w-full overflow-x-auto select-all animate-fade-in">
                            <div className="text-indigo-400 font-semibold mb-1 flex items-center gap-1">
                              <Code className="h-3 w-3" />
                              Payload Verzonden naar Webhook:
                            </div>
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
