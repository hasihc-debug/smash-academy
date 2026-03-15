
import React, { useState, useEffect } from 'react';
import { Activity, CalendarDays, Loader2, Zap, Trophy, Cake, Users, TrendingUp, Clock, ArrowRight, MapPin, ClipboardList, Wallet, ArrowUpRight, ArrowDownRight, IndianRupee, ChevronRight, Settings, X } from 'lucide-react';
import { appId } from '../utils/firebase';
import { dbService } from '../utils/db';
import { User, Session, Player, AcademySettings, AccessRequest, Tournament, StudentPayment, CoachSalary } from '../types';
import { formatDate, getMonday, getYTPYearAndWeek } from '../utils/helpers';

interface DashboardProps {
  user: User;
  userRole: string;
  setActiveTab: (tab: string) => void;
  academySettings: AcademySettings;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, userRole, setActiveTab, academySettings }) => {
  const [todaySessions, setTodaySessions] = useState<Session[]>([]);
  const [nextTournament, setNextTournament] = useState<Tournament | null>(null);
  const [birthdays, setBirthdays] = useState<{name: string, date: Date, ageTurning: number}[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [plannedIntensity, setPlannedIntensity] = useState<number | null>(null);
  
  // Financial State
  const [currentPayments, setCurrentPayments] = useState<StudentPayment[]>([]);
  const [currentSalaries, setCurrentSalaries] = useState<CoachSalary[]>([]);
  const [rosterPlayers, setRosterPlayers] = useState<Player[]>([]);
  
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [tempSettings, setTempSettings] = useState<AcademySettings>({ name: '', logoUrl: '' });
  const [isSaving, setIsSaving] = useState(false);

  const today = React.useMemo(() => new Date(), []);
  const todayStr = formatDate(today);
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const weekId = formatDate(getMonday(today));

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  useEffect(() => {
    if (!user) return;

    const unsubSchedule = dbService.subscribeSchedule(user, appId, weekId, (days) => { 
        const sessions = (days[todayStr] || []).sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
        setTodaySessions(sessions); 
    });
    const unsubRequests = dbService.subscribeAccessRequests(user, appId, (reqs) => { setAccessRequests(reqs); });
    
    const { year, week } = getYTPYearAndWeek(todayStr);
    const unsubYTP = dbService.subscribeYTP(user, appId, String(year), (data) => setPlannedIntensity(data?.[week]?.intensity || null));
    const unsubPlayers = dbService.subscribePlayers(user, appId, setRosterPlayers);
    
    const unsubTournaments = dbService.subscribeTournaments(user, appId, (data) => {
        const future = data
            .filter(t => t.startDate >= todayStr)
            .sort((a, b) => a.startDate.localeCompare(b.startDate));
        setNextTournament(future[0] || null);
    });

    const unsubPayments = dbService.subscribePayments(user, appId, currentMonth, currentYear, setCurrentPayments);
    const unsubSalaries = dbService.subscribeSalaries(user, appId, currentMonth, currentYear, setCurrentSalaries);

    return () => { 
      unsubSchedule(); unsubPlayers(); unsubRequests(); unsubYTP(); 
      unsubTournaments(); unsubPayments(); unsubSalaries();
    };
  }, [user, todayStr, weekId, currentMonth, currentYear]);

  useEffect(() => {
     const currentYear = today.getFullYear();
     
     const upcomingBirthdays: {name: string, date: Date, ageTurning: number}[] = [];
     rosterPlayers.forEach(p => {
        if (p.dob) {
           const dob = new Date(p.dob);
           const bdayThisYear = new Date(currentYear, dob.getMonth(), dob.getDate());
           const bdayNextYear = new Date(currentYear + 1, dob.getMonth(), dob.getDate());
           const nextBday = bdayThisYear.getTime() < new Date(today.getTime()).setHours(0,0,0,0) ? bdayNextYear : bdayThisYear;
           const diffDays = Math.ceil((nextBday.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)); 
           if (diffDays >= 0 && diffDays <= 45) { upcomingBirthdays.push({ name: p.name, date: nextBday, ageTurning: (nextBday.getFullYear() - dob.getFullYear()) }); }
        }
     });
     
     upcomingBirthdays.sort((a,b) => a.date.getTime() - b.date.getTime());
     
     setTimeout(() => {
       setBirthdays(upcomingBirthdays);
       setLoading(false);
     }, 0);
  }, [rosterPlayers, today]);

  const totalCollected = currentPayments.reduce((acc, p) => acc + p.amount, 0);
  const totalExpenses = currentSalaries.reduce((acc, s) => acc + s.amount, 0);

  const paidPlayerIds = new Set(currentPayments.map(p => p.playerId));
  const pendingPlayers = rosterPlayers.filter(p => !paidPlayerIds.has(p.id));
  const estimatedPending = pendingPlayers.reduce((acc, p) => acc + (p.monthlyFee || 0), 0);

  const handleSaveSettings = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      await dbService.saveAcademySettings(user, appId, tempSettings);
      setIsEditingSettings(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500000) {
        alert('Logo must be less than 500KB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setTempSettings(prev => ({ ...prev, logoUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return (
    <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500"/>
    </div>
  );

  return (
    <div className="p-6 lg:p-12 space-y-12 max-w-7xl mx-auto animate-fade-in pb-24">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex items-center gap-6">
          <div className="h-20 w-20 bg-white rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden shrink-0 ring-4 ring-slate-50">
               {academySettings.logoUrl ? <img src={academySettings.logoUrl} className="h-full w-full object-cover" /> : <Activity className="h-10 w-10 text-emerald-500" />}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-tight">
                  {academySettings.dashboardTitle || academySettings.name || 'Smash Academy'}
              </h1>
              {userRole === 'COACH' && (
                <button 
                  onClick={() => {
                    setTempSettings(academySettings);
                    setIsEditingSettings(true);
                  }}
                  className="p-2 hover:bg-slate-100 rounded-xl transition-all text-slate-400 hover:text-emerald-500"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-slate-400 font-semibold flex items-center gap-2 mt-1 text-sm">
                <CalendarDays className="h-4 w-4 text-emerald-500/60"/>
                {today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl shadow-sm border border-slate-100 ring-4 ring-slate-50/50">
           <div className="relative">
             <div className={`h-2.5 w-2.5 rounded-full ${user.uid.startsWith('demo-') ? 'bg-amber-400' : 'bg-emerald-500'}`}></div>
             <div className={`absolute inset-0 h-2.5 w-2.5 rounded-full ${user.uid.startsWith('demo-') ? 'bg-amber-400' : 'bg-emerald-500'} animate-ping opacity-75`}></div>
           </div>
           <span className="text-sm font-bold text-slate-700 tracking-tight">{greeting}, {user.displayName?.split(' ')[0]}</span>
        </div>
      </div>
      
      {accessRequests.length > 0 && (
          <div className="bg-indigo-600 rounded-3xl p-5 shadow-xl shadow-indigo-500/20 text-white flex justify-between items-center animate-slide-up border border-indigo-500/30">
              <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md border border-white/10"><Users className="h-6 w-6"/></div>
                  <div>
                    <h3 className="font-black text-base tracking-tight">New Access Requests</h3>
                    <p className="text-xs text-indigo-100 font-medium opacity-80">{accessRequests.length} athletes are waiting for approval</p>
                  </div>
              </div>
              <button onClick={() => setActiveTab('players')} className="px-6 py-2.5 bg-white text-indigo-600 text-xs font-black rounded-xl hover:bg-indigo-50 transition-all shadow-lg shadow-black/5 active:scale-95">Review All</button>
          </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        <div className="lg:col-span-8 space-y-10">
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div onClick={() => setActiveTab('players')} className="card-modern p-8 cursor-pointer group hover:ring-2 hover:ring-emerald-500/10 transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-emerald-50 transition-colors border border-slate-100 group-hover:border-emerald-100"><Users className="h-6 w-6 text-slate-400 group-hover:text-emerald-500"/></div>
                    </div>
                    <div>
                      <div className="text-4xl font-black text-slate-900 tracking-tighter">{rosterPlayers.length}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Total Athletes</div>
                    </div>
                </div>

                <div onClick={() => setActiveTab('tournaments')} className="card-modern p-8 cursor-pointer group relative overflow-hidden hover:ring-2 hover:ring-amber-500/10 transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-slate-50 rounded-2xl group-hover:bg-amber-50 transition-colors border border-slate-100 group-hover:border-amber-100"><Trophy className="h-6 w-6 text-slate-400 group-hover:text-amber-500"/></div>
                        {nextTournament && <span className="text-[10px] font-black text-amber-600 uppercase bg-amber-50 px-3 py-1 rounded-full border border-amber-100 shadow-sm">Upcoming</span>}
                    </div>
                    <div>
                        <div className="text-xl font-black text-slate-900 tracking-tight truncate leading-tight min-h-[40px] flex items-center gap-2">
                            {nextTournament ? nextTournament.name : 'No Events'}
                            {!nextTournament && <ChevronRight className="h-5 w-5 text-slate-300" />}
                        </div>
                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">
                            {nextTournament ? `${new Date(nextTournament.startDate).toLocaleDateString(undefined, {month:'short', day:'numeric'})}` : 'Plan next event'}
                        </div>
                    </div>
                </div>

                <div className="card-modern p-8 group hover:ring-2 hover:ring-indigo-500/10 transition-all">
                    <div className="flex justify-between items-start mb-6">
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100"><Zap className="h-6 w-6 text-indigo-500 fill-indigo-500"/></div>
                        <span className="text-[10px] font-black text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-[0.15em]">Week {getYTPYearAndWeek(todayStr).week}</span>
                    </div>
                    <div>
                      <div className="flex items-baseline gap-2">
                        <div className="text-4xl font-black text-slate-900 tracking-tighter">{plannedIntensity || '-'}</div>
                        <div className="text-sm font-black text-slate-300">/ 10</div>
                      </div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Intensity</div>
                    </div>
                </div>
            </div>

            <div className="bg-slate-950 rounded-[2.5rem] p-10 shadow-2xl shadow-slate-900/40 relative overflow-hidden group border border-white/5">
                <div className="absolute -top-20 -right-20 p-8 opacity-5 group-hover:opacity-10 transition-all duration-700 group-hover:scale-110"><Wallet className="h-80 w-80 rotate-12 text-white" /></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-center mb-10">
                        <h3 className="text-white font-black text-xl flex items-center gap-4 tracking-tight"><Wallet className="h-6 w-6 text-emerald-400"/> Financial Pulse</h3>
                        <button onClick={() => setActiveTab('finance')} className="px-5 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black text-emerald-400 hover:text-white transition-all flex items-center gap-2">Manage <ArrowRight className="h-3.5 w-3.5"/></button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                            <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><ArrowUpRight className="h-3.5 w-3.5 text-emerald-400"/> Collected</div>
                            <div className="text-3xl font-black text-white flex items-center gap-1.5 tracking-tighter"><IndianRupee className="h-5 w-5 text-slate-500"/>{totalCollected.toLocaleString()}</div>
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                            <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><TrendingUp className="h-3.5 w-3.5 text-amber-400"/> Pending</div>
                            <div className="text-3xl font-black text-amber-400 flex items-center gap-1.5 tracking-tighter"><IndianRupee className="h-5 w-5 text-slate-500"/>{estimatedPending.toLocaleString()}</div>
                        </div>
                        <div className="bg-white/5 border border-white/5 rounded-3xl p-6 backdrop-blur-sm">
                            <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 flex items-center gap-2"><ArrowDownRight className="h-3.5 w-3.5 text-rose-400"/> Salaries</div>
                            <div className="text-3xl font-black text-white flex items-center gap-1.5 tracking-tighter"><IndianRupee className="h-5 w-5 text-slate-500"/>{totalExpenses.toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card-modern overflow-hidden rounded-[2.5rem]">
                 <div className="px-10 py-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
                    <h3 className="font-black text-xl text-slate-900 tracking-tight flex items-center gap-4"><Clock className="h-6 w-6 text-slate-400"/> Today&apos;s Schedule</h3>
                    <button onClick={() => setActiveTab('weekly')} className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.2em] hover:text-emerald-700 transition-colors">Full Week</button>
                 </div>
                 <div className="p-8 space-y-6">
                    {todaySessions.length === 0 ? (
                      <div className="text-center py-16 text-slate-400 font-medium flex flex-col items-center gap-4">
                        <div className="p-4 bg-slate-50 rounded-full"><CalendarDays className="h-8 w-8 text-slate-200"/></div>
                        <p className="text-sm">No training sessions scheduled for today.</p>
                      </div>
                    ) : todaySessions.map((session, idx) => (
                      <div key={idx} className="flex flex-col gap-4 p-6 rounded-[2rem] bg-white border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all group">
                        <div className="flex justify-between items-start gap-6">
                            <div className="flex items-center gap-5">
                                <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl px-4 py-3 border border-slate-100 min-w-[85px] group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
                                    <span className="text-base font-black text-slate-900 group-hover:text-emerald-600 transition-colors">{session.startTime}</span>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{session.endTime}</span>
                                </div>
                                <div>
                                     <h4 className="font-black text-slate-900 text-lg tracking-tight">{session.description || 'Training Session'}</h4>
                                     {session.location && <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 mt-1"><MapPin className="h-3.5 w-3.5 text-emerald-500/60"/> {session.location}</div>}
                                </div>
                            </div>
                            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border bg-slate-50 text-slate-600 border-slate-200 group-hover:bg-emerald-500 group-hover:text-white group-hover:border-emerald-500 transition-all">{session.type}</span>
                        </div>
                        {session.drills && (
                            <div className="bg-slate-50/50 rounded-2xl p-4 border border-slate-100/50 flex gap-3 group-hover:bg-white transition-colors">
                                <ClipboardList className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5"/>
                                <p className="text-sm text-slate-600 font-semibold leading-relaxed whitespace-pre-wrap line-clamp-2">{session.drills}</p>
                            </div>
                        )}
                      </div>
                    ))}
                 </div>
            </div>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <div className="grid grid-cols-2 gap-4">
               <button onClick={() => setActiveTab('players')} className="p-6 bg-slate-900 rounded-[2rem] text-white hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 flex flex-col items-center gap-3 text-center group active:scale-95">
                 <div className="p-3 bg-white/10 rounded-2xl group-hover:scale-110 transition-transform"><Users className="h-6 w-6"/></div>
                 <span className="text-xs font-black uppercase tracking-widest">Add Athlete</span>
               </button>
               <button onClick={() => setActiveTab('finance')} className="p-6 bg-white border border-slate-200 rounded-[2rem] text-slate-700 hover:border-emerald-300 transition-all shadow-sm flex flex-col items-center gap-3 text-center group active:scale-95">
                 <div className="p-3 bg-slate-50 rounded-2xl group-hover:scale-110 transition-transform"><Wallet className="h-6 w-6 text-slate-400 group-hover:text-emerald-500"/></div>
                 <span className="text-xs font-black uppercase tracking-widest">Manage Fees</span>
               </button>
           </div>
           
           <div className="bg-gradient-to-br from-rose-50 to-white rounded-[2.5rem] shadow-sm border border-rose-100 overflow-hidden">
              <div className="px-8 py-6 border-b border-rose-100/50 flex justify-between items-center bg-rose-50/30">
                <h3 className="font-black text-rose-900 text-sm flex items-center gap-3 uppercase tracking-widest"><Cake className="h-5 w-5 text-rose-500"/> Birthdays</h3>
              </div>
              <div className="p-6">
                 {birthdays.length === 0 ? (
                   <div className="text-center text-xs text-rose-300 py-10 font-bold uppercase tracking-widest">No upcoming birthdays</div>
                 ) : (
                   <div className="space-y-3">
                     {birthdays.map((b, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 rounded-2xl bg-white border border-rose-100/50 shadow-sm hover:shadow-md transition-all group">
                          <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-black text-sm group-hover:scale-110 transition-transform">{b.date.getDate()}</div>
                          <div>
                            <div className="text-sm font-black text-slate-800">{b.name}</div>
                            <div className="text-[10px] text-rose-500 font-black uppercase tracking-widest mt-0.5">Turning {b.ageTurning}</div>
                          </div>
                        </div>
                     ))}
                   </div>
                 )}
              </div>
           </div>

           <div className="card-modern p-8 bg-indigo-50/30 border-indigo-100 rounded-[2.5rem]">
              <h3 className="text-indigo-900 font-black text-sm uppercase tracking-widest mb-6 flex items-center gap-3"><TrendingUp className="h-5 w-5 text-indigo-500"/> Quick Insights</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Active Roster</span>
                  <span className="text-sm font-black text-indigo-600">{rosterPlayers.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Payment Rate</span>
                  <span className="text-sm font-black text-emerald-600">{rosterPlayers.length > 0 ? Math.round((paidPlayerIds.size / rosterPlayers.length) * 100) : 0}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">Next Event</span>
                  <span className="text-sm font-black text-amber-600">{nextTournament ? 'Scheduled' : 'None'}</span>
                </div>
              </div>
           </div>
        </div>
      </div>

      {/* Academy Settings Modal */}
      {isEditingSettings && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-md overflow-hidden animate-scale-in border border-slate-100">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Academy Settings</h2>
              <button onClick={() => setIsEditingSettings(false)} className="p-3 hover:bg-slate-200 rounded-2xl transition-all text-slate-400 hover:text-slate-900">
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-8 space-y-8">
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4">
                  <div className="h-32 w-32 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden relative group shadow-inner transition-all hover:border-emerald-300">
                    {tempSettings.logoUrl ? (
                      <img src={tempSettings.logoUrl} className="h-full w-full object-cover" />
                    ) : (
                      <Activity className="h-12 w-12 text-slate-300" />
                    )}
                    <label className="absolute inset-0 bg-slate-900/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      <span className="text-white text-xs font-black uppercase tracking-widest">Change Logo</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handleLogoUpload} />
                    </label>
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Academy Branding</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Academy Name</label>
                  <input
                    type="text"
                    value={tempSettings.name}
                    onChange={(e) => setTempSettings(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none"
                    placeholder="Enter academy name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dashboard Title</label>
                  <input
                    type="text"
                    value={tempSettings.dashboardTitle || ''}
                    onChange={(e) => setTempSettings(prev => ({ ...prev, dashboardTitle: e.target.value }))}
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none"
                    placeholder="Enter dashboard title"
                  />
                  <p className="text-[10px] text-slate-400 font-bold ml-1 italic opacity-70">Optional: Overrides name in header.</p>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  onClick={() => setIsEditingSettings(false)}
                  className="flex-1 px-6 py-4 border border-slate-200 text-slate-600 font-black rounded-2xl hover:bg-slate-50 transition-all text-sm uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveSettings}
                  disabled={isSaving}
                  className="flex-1 px-6 py-4 bg-emerald-500 text-white font-black rounded-2xl hover:bg-emerald-600 shadow-xl shadow-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm uppercase tracking-widest"
                >
                  {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Save'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
