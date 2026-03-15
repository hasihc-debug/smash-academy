
import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Check, Clock, Plus, UserCheck, Trash2, CalendarDays, MapPin, Loader2, Wand2, Copy, CalendarPlus } from 'lucide-react';
import { appId } from '../utils/firebase';
import { dbService } from '../utils/db';
import { User, Session, Player } from '../types';
import { formatDate, getDaysOfWeek, callGemini } from '../utils/helpers';

interface WeeklyScheduleProps {
  user: User;
  currentWeekStart: Date;
  setCurrentWeekStart: (date: Date) => void;
}

export const WeeklySchedule: React.FC<WeeklyScheduleProps> = ({ user, currentWeekStart, setCurrentWeekStart }) => {
  const [scheduleData, setScheduleData] = useState<Record<string, Session[]>>({}); 
  const [activeSession, setActiveSession] = useState<(Session & { dateStr: string }) | null>(null); 
  const [players, setPlayers] = useState<Player[]>([]);
  const [isSaving, setIsSaving] = useState<string | null>(null); 
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  
  const weekId = formatDate(currentWeekStart);
  const weekDays = useMemo(() => getDaysOfWeek(currentWeekStart), [currentWeekStart]);

  const timeOptions = useMemo(() => {
    const times = [];
    for(let i=5; i<23; i++) {
        const h = i.toString().padStart(2, '0');
        times.push(`${h}:00`, `${h}:15`, `${h}:30`, `${h}:45`);
    }
    return times;
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsub = dbService.subscribePlayers(user, appId, (data) => {
        setPlayers(data.sort((a:Player, b:Player) => a.name.localeCompare(b.name)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsub = dbService.subscribeSchedule(user, appId, weekId, (days) => {
        setScheduleData(days || {});
    });
    return () => unsub();
  }, [user, weekId]);

  const handleSaveError = (error: any) => { if (error.code === 'permission-denied') alert("Database Access Denied."); };

  const addSession = async (dateStr: string) => {
    const newSession: Session = { id: crypto.randomUUID(), startTime: "08:00", endTime: "10:00", description: "", type: "Technical", attendees: [], location: "", drills: "" };
    const updatedDays = { ...scheduleData, [dateStr]: [...(scheduleData[dateStr] || []), newSession] };
    try { await dbService.saveScheduleDay(user, appId, weekId, updatedDays); } catch(e) { handleSaveError(e); }
  };

  const updateSession = async (dateStr: string, sessionId: string, field: keyof Session, value: any) => {
    setIsSaving(sessionId);
    const updatedDays = { 
        ...scheduleData, 
        [dateStr]: (scheduleData[dateStr] || []).map(s => s.id === sessionId ? {...s, [field]: value} : s) 
    };
    
    setScheduleData(updatedDays);
    
    try { 
        await dbService.saveScheduleDay(user, appId, weekId, updatedDays); 
        setTimeout(() => setIsSaving(null), 800);
    } catch(e) { 
        handleSaveError(e); 
        setIsSaving(null);
    }
  };

  const generateAIDrills = async (dateStr: string, session: Session) => {
      if (!session.description) {
          alert("Please enter a Session Focus (e.g. 'Backhand Defense') first.");
          return;
      }
      setIsGenerating(session.id);
      try {
          const prompt = `Act as a professional high-performance badminton coach. Create a concise 3-drill session plan for a training focused on "${session.description}". 
          The session type is ${session.type}. Keep each drill description to one sentence. Format as a clean bulleted list. 
          Use professional terminology like 'multi-feed', 'shadow', 'half-court', etc. Total length under 50 words.`;
          
          const result = await callGemini(prompt);
          if (result) {
              await updateSession(dateStr, session.id, 'drills', result);
          }
      } catch {
          alert("AI Generation failed. Check your API key or connection.");
      } finally {
          setIsGenerating(null);
      }
  };

  const toggleAttendee = async (playerId: string) => {
    if (!activeSession) return;
    const { dateStr, id, attendees } = activeSession;
    const isAdding = !(attendees || []).includes(playerId);
    const newAttendees = isAdding ? [...(attendees || []), playerId] : (attendees || []).filter(pid => pid !== playerId);
    
    setActiveSession({ ...activeSession, attendees: newAttendees });
    
    const updatedDays = { 
        ...scheduleData, 
        [dateStr]: (scheduleData[dateStr] || []).map(s => s.id === id ? {...s, attendees: newAttendees} : s) 
    };
    setScheduleData(updatedDays);
    
    const sessionDate = new Date(dateStr);
    try { 
        await dbService.saveScheduleDay(user, appId, weekId, updatedDays); 
        await dbService.syncAttendanceForDay(user, appId, sessionDate, playerId);
    } catch(e) { 
        handleSaveError(e); 
    }
  };

  const deleteSession = async (dateStr: string, sessionId: string) => {
      if(!confirm('Delete session?')) return;
      const sessionToDelete = scheduleData[dateStr]?.find(s => s.id === sessionId);
      const updatedDays = { ...scheduleData, [dateStr]: (scheduleData[dateStr] || []).filter(s => s.id !== sessionId) }; 
      setScheduleData(updatedDays); 
      
      try { 
          await dbService.saveScheduleDay(user, appId, weekId, updatedDays); 
          if (sessionToDelete?.attendees) {
              for (const pid of sessionToDelete.attendees) {
                  await dbService.syncAttendanceForDay(user, appId, new Date(dateStr), pid);
              }
          }
      } catch(e) { handleSaveError(e); }
  };

  const copyToNextWeek = async () => {
    if (!confirm('Copy this week\'s schedule to next week? This will overwrite next week\'s existing sessions.')) return;
    
    const nextWeekStart = new Date(currentWeekStart);
    nextWeekStart.setDate(nextWeekStart.getDate() + 7);
    const nextWeekId = formatDate(nextWeekStart);
    
    const nextWeekDays = getDaysOfWeek(nextWeekStart);
    const nextWeekData: Record<string, Session[]> = {};
    
    weekDays.forEach((day, index) => {
        const currentDateStr = formatDate(day);
        const nextDateStr = formatDate(nextWeekDays[index]);
        const currentSessions = scheduleData[currentDateStr] || [];
        
        nextWeekData[nextDateStr] = currentSessions.map(s => ({
            ...s,
            id: crypto.randomUUID(),
            attendees: [] 
        }));
    });
    
    try {
        await dbService.saveScheduleDay(user, appId, nextWeekId, nextWeekData);
        setCurrentWeekStart(nextWeekStart);
    } catch (e) {
        handleSaveError(e);
    }
  };

  return (
    <div className="p-8 lg:p-12 flex flex-col h-full max-w-full animate-fade-in pb-24 space-y-12">
      {/* Attendance Modal */}
      {activeSession && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-lg flex flex-col max-h-[80vh] animate-scale-in border border-white/10">
            <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-white/90 backdrop-blur-md z-10">
                <div>
                    <h3 className="font-black text-3xl text-slate-900 tracking-tighter">Attendance</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{activeSession.startTime} • {new Date(activeSession.dateStr).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}</p>
                    </div>
                </div>
                <button onClick={() => setActiveSession(null)} className="p-4 hover:bg-slate-100 rounded-[1.5rem] text-slate-400 hover:text-slate-900 transition-all"><X className="h-6 w-6"/></button>
            </div>
            <div className="p-10 overflow-y-auto flex-1 grid grid-cols-1 gap-3 custom-scrollbar">
                {players.map(player => {
                  const isPresent = activeSession.attendees?.includes(player.id);
                  return (
                    <button key={player.id} onClick={() => toggleAttendee(player.id)} className={`flex items-center justify-between p-5 rounded-2xl border transition-all active:scale-[0.98] group ${isPresent ? 'bg-emerald-50 border-emerald-100 ring-1 ring-emerald-50 shadow-sm' : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all ${isPresent ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'border-slate-200 bg-slate-50 group-hover:bg-white'}`}>
                              {isPresent ? <Check className="h-5 w-5 stroke-[4]" /> : <UserCheck className="h-5 w-5 text-slate-300" />}
                          </div>
                          <span className={`text-sm font-black ${isPresent ? 'text-emerald-900' : 'text-slate-600'}`}>{player.name}</span>
                        </div>
                        {isPresent && <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Present</span>}
                    </button>
                  );
                })}
            </div>
            <div className="p-10 border-t border-slate-50 bg-slate-50/30">
                <button onClick={() => setActiveSession(null)} className="w-full bg-slate-950 text-white font-black py-5 rounded-2xl hover:bg-slate-900 transition-all shadow-2xl shadow-slate-900/20 text-xs uppercase tracking-widest">Done Marking</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-12 gap-8">
        <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Schedule</h2>
            <div className="flex items-center gap-3 mt-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Academy Weekly Planner</span>
            </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 w-full xl:w-auto">
            <div className="flex items-center bg-white rounded-[2rem] p-2 shadow-sm border border-slate-100">
                <button onClick={() => {
                    const newDate = new Date(currentWeekStart);
                    newDate.setDate(newDate.getDate() - 7);
                    setCurrentWeekStart(newDate);
                }} className="p-4 hover:bg-slate-50 rounded-[1.5rem] text-slate-400 hover:text-slate-900 transition-all"><ChevronLeft className="h-6 w-6"/></button>
                
                <button 
                    onClick={() => setCurrentWeekStart(getMonday(new Date()))}
                    className="px-4 py-2 hover:bg-slate-50 rounded-xl text-[10px] font-black text-slate-400 hover:text-slate-900 transition-all uppercase tracking-widest"
                >
                    Today
                </button>

                <div className="px-6 flex flex-col items-center min-w-[180px]">
                    <span className="text-base font-black text-slate-900 tracking-tight">{weekDays[0].toLocaleDateString(undefined, {month:'short', day:'numeric'})} — {weekDays[6].toLocaleDateString(undefined, {month:'short', day:'numeric'})}</span>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Week {weekId}</span>
                </div>
                
                <button onClick={() => {
                    const newDate = new Date(currentWeekStart);
                    newDate.setDate(newDate.getDate() + 7);
                    setCurrentWeekStart(newDate);
                }} className="p-4 hover:bg-slate-50 rounded-[1.5rem] text-slate-400 hover:text-slate-900 transition-all"><ChevronRight className="h-6 w-6"/></button>
            </div>

            <div className="flex items-center gap-3">
                <button 
                    onClick={copyToNextWeek}
                    className="flex items-center gap-2 px-6 py-4 bg-white border border-slate-100 text-slate-600 font-black rounded-[1.5rem] hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm text-[10px] uppercase tracking-widest"
                    title="Copy this week to next week"
                >
                    <Copy className="h-4 w-4" /> Copy to Next
                </button>
                
                <button 
                    onClick={() => {
                        const nextWeek = new Date(currentWeekStart);
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        setCurrentWeekStart(nextWeek);
                    }}
                    className="flex items-center gap-2 px-8 py-4 bg-slate-950 text-white font-black rounded-[1.5rem] hover:bg-slate-900 transition-all shadow-xl shadow-slate-900/20 text-[10px] uppercase tracking-widest"
                >
                    <CalendarPlus className="h-4 w-4" /> Plan Next Week
                </button>
            </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {weekDays.map(day => {
          const dateStr = formatDate(day);
          const sessions = scheduleData[dateStr] || [];
          const isToday = formatDate(new Date()) === dateStr;

          return (
            <div key={dateStr} className={`flex flex-col space-y-8 ${day.getDay() === 0 || day.getDay() === 6 ? 'opacity-60' : ''}`}>
              <div className={`p-6 rounded-[2.5rem] border transition-all duration-700 relative overflow-hidden group ${isToday ? 'bg-emerald-50 border-emerald-100 shadow-2xl shadow-emerald-500/10' : 'bg-white border-slate-100 shadow-sm hover:shadow-xl'}`}>
                {isToday && <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-8 -mt-8"></div>}
                <div className="flex justify-between items-center relative z-10">
                    <div>
                        <div className={`text-[10px] font-black uppercase tracking-[0.2em] ${isToday ? 'text-emerald-600' : 'text-slate-400'}`}>{day.toLocaleDateString(undefined, {weekday:'long'})}</div>
                        <div className={`text-3xl font-black mt-1 ${isToday ? 'text-emerald-950' : 'text-slate-900'}`}>{day.getDate()}</div>
                    </div>
                    <button onClick={() => addSession(dateStr)} className={`p-4 rounded-[1.5rem] transition-all active:scale-90 group-hover:scale-110 ${isToday ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xl shadow-emerald-500/40' : 'bg-slate-50 text-slate-400 hover:bg-slate-950 hover:text-white hover:shadow-xl hover:shadow-slate-900/20'}`}><Plus className="h-6 w-6 stroke-[3]"/></button>
                </div>
              </div>
              
              <div className="space-y-8">
                {sessions.length === 0 && (
                    <div className="py-20 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 rounded-[2.5rem] text-slate-300 bg-slate-50/20">
                        <CalendarDays className="h-12 w-12 mb-4 opacity-10" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30">Rest Day</span>
                    </div>
                )}
                {sessions.map(session => (
                  <div key={session.id} className="bg-white rounded-[2.5rem] p-8 space-y-8 group relative border border-slate-50 shadow-2xl shadow-slate-200/50 hover:shadow-emerald-500/10 hover:border-emerald-100 transition-all duration-700">
                     <div className="flex justify-between items-start">
                        <div className="flex items-center gap-4 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100">
                            <Clock className="h-4 w-4 text-slate-400" />
                            <div className="flex items-center gap-2">
                                <select className="bg-transparent text-[11px] font-black text-slate-700 outline-none appearance-none cursor-pointer" value={session.startTime} onChange={e => updateSession(dateStr, session.id, 'startTime', e.target.value)}>
                                    {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                                <span className="text-[9px] font-black text-slate-300">—</span>
                                <select className="bg-transparent text-[11px] font-black text-slate-700 outline-none appearance-none cursor-pointer" value={session.endTime} onChange={e => updateSession(dateStr, session.id, 'endTime', e.target.value)}>
                                    {timeOptions.map(t => <option key={t} value={t}>{t}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {isSaving === session.id ? (
                                <Loader2 className="h-4 w-4 animate-spin text-emerald-500" />
                            ) : (
                                <div className="text-[8px] font-black text-emerald-500 bg-emerald-50 px-2.5 py-1 rounded-lg uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">Saved</div>
                            )}
                        </div>
                     </div>

                     <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Session Focus</label>
                            <input 
                                type="text" 
                                placeholder="e.g. Backhand Defense" 
                                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-black text-slate-900 outline-none placeholder:text-slate-200" 
                                value={session.description} 
                                onBlur={(e) => updateSession(dateStr, session.id, 'description', e.target.value)}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setScheduleData(prev => ({
                                        ...prev,
                                        [dateStr]: (prev[dateStr] || []).map(s => s.id === session.id ? {...s, description: val} : s)
                                    }));
                                }} 
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Type</label>
                                <select 
                                    className={`w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-black text-[11px] uppercase outline-none appearance-none cursor-pointer
                                        ${session.type === 'Technical' ? 'text-blue-600' : ''}
                                        ${session.type === 'Tactical' ? 'text-purple-600' : ''}
                                        ${session.type === 'Physical' ? 'text-amber-600' : ''}
                                    `} 
                                    value={session.type} 
                                    onChange={(e) => updateSession(dateStr, session.id, 'type', e.target.value)}
                                >
                                    <option>Technical</option><option>Tactical</option><option>Physical</option><option>Match</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Location</label>
                                <div className="relative">
                                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                                    <input 
                                        type="text" 
                                        placeholder="Court #" 
                                        className="w-full pl-12 pr-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-black text-[11px] outline-none" 
                                        value={session.location || ''} 
                                        onBlur={(e) => updateSession(dateStr, session.id, 'location', e.target.value)} 
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setScheduleData(prev => ({
                                                ...prev,
                                                [dateStr]: (prev[dateStr] || []).map(s => s.id === session.id ? {...s, location: val} : s)
                                            }));
                                        }}
                                    />
                                </div>
                            </div>
                        </div>
                     </div>
                     
                     <div className="space-y-4 p-6 bg-indigo-50/30 rounded-[2rem] border border-indigo-100/50 relative overflow-hidden group/ai">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 transition-all group-hover/ai:scale-150"></div>
                        <div className="flex justify-between items-center relative z-10">
                            <label className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2"><Wand2 className="h-4 w-4" /> AI Training Plan</label>
                            <button 
                                onClick={() => generateAIDrills(dateStr, session)}
                                disabled={isGenerating === session.id}
                                className="text-[10px] font-black text-indigo-500 hover:text-indigo-700 disabled:opacity-50 transition-colors bg-white px-3 py-1 rounded-lg shadow-sm border border-indigo-100"
                            >
                                {isGenerating === session.id ? <Loader2 className="h-3.5 w-3.5 animate-spin"/> : 'REGENERATE'}
                            </button>
                        </div>
                        <textarea 
                            placeholder="Drills & details..." 
                            className="w-full bg-transparent text-xs h-32 resize-none outline-none transition-all text-slate-700 font-semibold leading-relaxed custom-scrollbar relative z-10 placeholder:text-indigo-200" 
                            value={session.drills || ''} 
                            onBlur={(e) => updateSession(dateStr, session.id, 'drills', e.target.value)}
                            onChange={(e) => {
                                const val = e.target.value;
                                setScheduleData(prev => ({
                                    ...prev,
                                    [dateStr]: (prev[dateStr] || []).map(s => s.id === session.id ? {...s, drills: val} : s)
                                }));
                            }}
                        />
                     </div>
                     
                     <div className="flex items-center gap-4 pt-2">
                        <button onClick={() => setActiveSession({...session, dateStr})} className="flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl text-[11px] font-black bg-slate-950 text-white hover:bg-slate-900 transition-all shadow-2xl shadow-slate-900/20 active:scale-95">
                            <UserCheck className="h-5 w-5" /> {session.attendees?.length || 0} ATHLETES
                        </button>
                        <button onClick={() => deleteSession(dateStr, session.id)} className="p-5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-2xl transition-all border border-slate-100 hover:border-rose-100 active:scale-95">
                            <Trash2 className="h-5 w-5" />
                        </button>
                     </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
