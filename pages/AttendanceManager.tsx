import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, Edit2, Lock } from 'lucide-react';
import { appId } from '../utils/firebase';
import { dbService } from '../utils/db';
import { User, Player } from '../types';

interface AttendanceManagerProps {
  user: User;
}

export const AttendanceManager: React.FC<AttendanceManagerProps> = ({ user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [players, setPlayers] = useState<Player[]>([]);
  const [attendanceData, setAttendanceData] = useState<Record<string, Record<string, string | null>>>({});
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [isEditMode, setIsEditMode] = useState(false);

  const docId = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  useEffect(() => {
    if (!user) return;
    const unsub = dbService.subscribePlayers(user, appId, (data) => {
        setPlayers(data.sort((a:Player, b:Player) => a.name.localeCompare(b.name)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchSessionCounts = async () => {
       const counts = await dbService.getScheduleCounts(user, appId, currentDate);
       setSessionCounts(counts);
    };
    fetchSessionCounts();
  }, [user, currentDate]);

  useEffect(() => {
    if (!user) return;
    
    const unsub = dbService.subscribeAttendance(user, appId, docId, (records) => {
      setAttendanceData(records || {});
      setLoading(false);
    });
    return () => unsub();
  }, [user, docId]);

  const toggleAttendance = async (playerId: string, day: number) => {
    if (!user || !isEditMode) return;
    const dayStr = String(day);
    const currentStatus = attendanceData[playerId]?.[dayStr];
    const sessionsToday = sessionCounts[dayStr] || 1;
    let newStatus = null;
    
    if (sessionsToday > 1) {
       // Multi-session logic
       if (!currentStatus) newStatus = `1/${sessionsToday}`;
       else if (currentStatus === 'A') newStatus = null;
       else if (currentStatus.includes('/')) {
          const [attended, total] = currentStatus.split('/').map(Number);
          newStatus = attended < total ? `${attended + 1}/${total}` : 'A';
       } else { newStatus = `1/${sessionsToday}`; }
    } else {
       // Single session logic: P -> A -> L -> R -> null
       if (!currentStatus) newStatus = 'P'; 
       else if (currentStatus === 'P') newStatus = 'A'; 
       else if (currentStatus === 'A') newStatus = 'L'; 
       else if (currentStatus === 'L') newStatus = 'R'; 
       else if (currentStatus === 'R') newStatus = null;
    }
    
    const updatedData = { ...attendanceData, [playerId]: { ...(attendanceData[playerId] || {}), [dayStr]: newStatus } };
    setAttendanceData(updatedData); // Optimistic UI
    
    // Save to DB
    try {
        await dbService.saveAttendance(user, appId, docId, updatedData);
    } catch (error: any) {
        console.error(error);
        const errorMsg = error.message || "";
        if (errorMsg.includes('permission-denied') || errorMsg.includes('Missing or insufficient permissions')) {
             alert("Database Access Denied.\n\nPlease copy the content of 'firestore.rules' from your project and paste it into:\nFirebase Console > Firestore Database > Rules");
        }
    }
  };

  const calculatePercentage = (playerId: string) => {
    const playerRecord = attendanceData[playerId] || {};
    let presentCount = 0; let totalCount = 0;
    daysArray.forEach(day => {
       const dayStr = String(day);
       const status = playerRecord[dayStr];
       const sessionsToday = sessionCounts[dayStr] || 1;
       if (status) { 
          totalCount += sessionsToday; 
          if (status.includes('/')) { presentCount += Number(status.split('/')[0]); } else if (status !== 'A') { presentCount += sessionsToday; }
       }
    });
    return totalCount === 0 ? '-' : Math.round((presentCount / totalCount) * 100) + '%';
  };

  return (
    <div className="p-6 lg:p-12 flex flex-col h-full max-w-full overflow-hidden bg-[#F8FAFC]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-light text-slate-900 tracking-tight mb-1">
            Attendance <span className="font-serif italic text-slate-400">Registry</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">Monitor athlete consistency and session participation.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={() => setIsEditMode(!isEditMode)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-2xl border transition-all font-bold text-sm shadow-sm
              ${isEditMode 
                ? 'bg-emerald-500 border-emerald-400 text-white shadow-emerald-500/20' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
          >
            {isEditMode ? <Lock className="h-4 w-4" /> : <Edit2 className="h-4 w-4" />}
            {isEditMode ? 'Finish Editing' : 'Edit Attendance'}
          </button>

          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
            >
              <ChevronLeft className="h-5 w-5"/>
            </button>
            <div className="px-6 py-1.5 text-center min-w-[180px]">
              <span className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-0.5">Active Period</span>
              <span className="block font-bold text-slate-900 text-sm">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
            </div>
            <button 
              onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
            >
              <ChevronRight className="h-5 w-5"/>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="overflow-auto custom-scrollbar flex-1 relative">
          <table className="w-full text-sm text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-30">
              <tr className="bg-slate-50/80 backdrop-blur-md">
                <th className="px-8 py-6 sticky left-0 bg-slate-50/95 backdrop-blur-md z-40 border-b border-r border-slate-200">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400">Athlete Name</span>
                </th>
                <th className="px-6 py-6 text-center border-b border-r border-slate-200 bg-emerald-50/50">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-black text-emerald-600">Rate</span>
                </th>
                {daysArray.map(day => (
                  <th key={day} className={`px-2 py-6 text-center min-w-[48px] border-b border-slate-100 transition-colors ${sessionCounts[day] ? 'bg-white' : 'bg-slate-50/30'}`}>
                    <span className={`text-[11px] font-mono font-bold ${sessionCounts[day] ? 'text-slate-900' : 'text-slate-300'}`}>
                      {String(day).padStart(2, '0')}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={daysArray.length + 2} className="py-20 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-xs uppercase tracking-widest">Loading Registry...</span>
                    </div>
                  </td>
                </tr>
              ) : players.map(player => (
                <tr key={player.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-4 sticky left-0 bg-white group-hover:bg-slate-50/50 backdrop-blur-md z-20 border-r border-slate-100 font-bold text-slate-700 whitespace-nowrap transition-colors">
                    {player.name}
                  </td>
                  <td className="px-6 py-4 text-center font-mono font-bold text-emerald-600 border-r border-slate-100 bg-emerald-50/10">
                    {calculatePercentage(player.id)}
                  </td>
                  {daysArray.map(day => {
                    const status = attendanceData[player.id]?.[String(day)];
                    const hasSession = sessionCounts[day] > 0;
                    return (
                      <td key={day} className={`px-1 py-2 text-center border-r border-slate-50 last:border-r-0 ${!hasSession ? 'bg-slate-50/20' : ''}`}>
                        <button 
                          onClick={() => toggleAttendance(player.id, day)} 
                          disabled={!isEditMode}
                          className={`w-10 h-10 rounded-xl mx-auto text-[10px] font-mono font-bold border transition-all duration-300 flex items-center justify-center
                            ${!status ? 'bg-transparent border-transparent text-transparent' : ''}
                            ${!status && isEditMode ? 'hover:bg-white hover:border-slate-200 hover:shadow-sm' : ''}
                            ${status === 'P' ? 'bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20 scale-105' : ''}
                            ${status === 'A' ? 'bg-rose-50 border-rose-100 text-rose-500' : ''}
                            ${status === 'L' ? 'bg-amber-50 border-amber-100 text-amber-500' : ''}
                            ${status === 'R' ? 'bg-slate-100 border-slate-200 text-slate-600' : ''}
                            ${status && status.includes('/') ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : ''}
                            ${!isEditMode ? 'cursor-default' : 'cursor-pointer'}
                            ${!hasSession && !status ? 'opacity-20' : ''}
                          `}
                        >
                          {status === 'P' ? <Check className="h-4 w-4 stroke-[3]" /> : status}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-8 items-center justify-center md:justify-start">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-md bg-emerald-500 shadow-sm shadow-emerald-500/20"></div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Present</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-md bg-rose-50 border border-rose-200"></div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Absent</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-md bg-amber-50 border border-amber-200"></div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Late</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-md bg-indigo-50 border border-indigo-200"></div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Partial</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 rounded-md bg-slate-100 border border-slate-200"></div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">Released</span>
          </div>
        </div>
      </div>
    </div>
  );
};
