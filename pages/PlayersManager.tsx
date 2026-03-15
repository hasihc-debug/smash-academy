
import React, { useState, useEffect } from 'react';
import { 
  Plus, Save, Trash2, X, Sparkles, Loader2, User, History as HistoryIcon, Mail, Check, Copy, ExternalLink, MapPin, ClipboardList, Clock, ChevronRight, Trophy
} from 'lucide-react';
import { collection, query, limit, getDocs, where } from 'firebase/firestore'; 
import { db, appId } from '../utils/firebase';
import { dbService, isDemo, COLLECTIONS } from '../utils/db';
import { User as FirebaseUser, Player, Session, TournamentEntry } from '../types';
import { callGemini } from '../utils/helpers';

interface PlayersManagerProps { user: FirebaseUser; }

export const PlayersManager: React.FC<PlayersManagerProps> = ({ user }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'profile' | 'performance' | 'competition' | 'history'>('profile');
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Player | null>(null);
  const [inviteTarget, setInviteTarget] = useState<Player | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [viewPlayer, setViewPlayer] = useState<Player | null>(null);
  const [playerResults, setPlayerResults] = useState<TournamentEntry[]>([]);
  
  // States for player-mode result editing
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [trainingHistory, setTrainingHistory] = useState<any[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  
  const isPlayerRole = user.role === 'PLAYER';
  const initialFormState: Player = {
    id: '', name: '', email: '', age: '', dob: '', level: 'Beginner', gender: '', hand: '', phone: '', parentName: '', notes: '', photoUrl: '', strength: '', weakness: '', playerGoal: '', coachGoal: '', t1Name: '', t1Date: '', t1Priority: '', t2Name: '', t2Date: '', t2Priority: '', joinedDate: '', achievements: '', ageCategory: ''
  };
  const [formData, setFormData] = useState<Player>(initialFormState);

  const generateId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'player_' + Date.now();

  const fetchHistoryForPlayer = React.useCallback(async (p: Player) => {
      if (isDemo(user) || isPlayerRole) { setTrainingHistory([]); return; }
      try {
        const q = query(
          collection(db, COLLECTIONS.SCHEDULES), 
          where('userId', '==', user.uid),
          limit(12)
        ); 
        const snap = await getDocs(q);
        const sessions: any[] = [];
        snap.docs.forEach(doc => {
          const data = doc.data();
          Object.keys(data.days || {}).forEach(dateKey => {
            data.days[dateKey].forEach((session: Session) => {
              if (session.attendees?.includes(p.id)) {
                sessions.push({ date: dateKey, ...session });
              }
            });
          });
        });
        sessions.sort((a, b) => new Date(b.date + 'T' + (b.startTime)).getTime() - new Date(a.date + 'T' + (a.startTime)).getTime());
        setTrainingHistory(sessions);
      } catch {
          console.error("Error fetching history");
      }
  }, [user, isPlayerRole]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = dbService.subscribePlayers(user, appId, (data) => {
        const sorted = data.sort((a:Player, b:Player) => a.name.localeCompare(b.name));
        setPlayers(sorted);
        if (user.role === 'PLAYER' && user.linkedPlayerId) {
            const me = sorted.find(p => p.id === user.linkedPlayerId);
            if(me) { setViewPlayer(me); if (!isEditingProfile) setFormData(me); fetchHistoryForPlayer(me); }
        }
        setLoading(false);
    });
    return () => unsubscribe();
  }, [user, isEditingProfile, fetchHistoryForPlayer]);

  useEffect(() => {
      if (isEditing && activeModalTab === 'competition' && formData.id) { dbService.getPlayerResults(user, appId, formData.id).then(setPlayerResults); }
      if (isEditing && activeModalTab === 'history' && formData.id) { fetchHistoryForPlayer(formData); }
      if (viewPlayer) { dbService.getPlayerResults(user, appId, viewPlayer.id).then(setPlayerResults); }
  }, [isEditing, activeModalTab, formData.id, viewPlayer, user, fetchHistoryForPlayer, formData]);

  const handleGeneratePlan = async () => {
    if (!formData.strength && !formData.weakness) { alert("Please enter Strength or Weakness first."); return; }
    setIsGeneratingPlan(true);
    try {
      const result = await callGemini(`Act as a professional badminton coach. Based on a player with Strength: "${formData.strength}" and Weakness: "${formData.weakness}", suggest a concise 3-point plan. Under 50 words.`);
      setFormData(prev => ({ ...prev, notes: (prev.notes ? prev.notes + '\n\n' : '') + "✨ AI Plan:\n" + result }));
    } catch { alert("Failed to generate plan."); } finally { setIsGeneratingPlan(false); }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) { alert("File too large."); return; }
      const reader = new FileReader();
      reader.onloadend = () => { if(reader.result) setFormData(prev => ({ ...prev, photoUrl: reader.result as string })); };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
        const id = currentPlayer ? currentPlayer.id : (isPlayerRole && viewPlayer ? viewPlayer.id : generateId());
        const timestamp = currentPlayer ? currentPlayer.createdAt : (viewPlayer ? viewPlayer.createdAt : new Date().toISOString());
        const cleanData = JSON.parse(JSON.stringify({ ...formData, id, createdAt: timestamp }));
        await dbService.savePlayer(user, appId, cleanData);
        await dbService.syncPlayerEvents(user, appId, cleanData);
        setIsEditing(false); setIsEditingProfile(false); setCurrentPlayer(null);
        if(!isPlayerRole) setFormData(initialFormState);
        if(isPlayerRole) setViewPlayer(cleanData);
    } catch { alert(`Failed to save player.`); }
  };

  const handleAddClick = () => { setIsEditing(true); setCurrentPlayer(null); setFormData(initialFormState); setActiveModalTab('profile'); };
  const handleEdit = (player: Player) => { setViewPlayer(null); setCurrentPlayer(player); setActiveModalTab('profile'); setFormData(player); setIsEditing(true); };
  const confirmDelete = async () => { if (!deleteTarget) return; await dbService.deletePlayer(user, appId, deleteTarget.id); setDeleteTarget(null); };
  
  // Invite logic
  const getInviteMessage = (player: Player) => `Hi ${player.name},\n\nYou have been invited to join Smash Academy Pro.\n\n1. Go to: ${window.location.origin}\n2. Sign in with Google using: ${player.email}\n\nSee you on the court!`;
  const openInviteModal = (player: Player) => { if (!player.email) { alert("Please save an email first."); return; } setInviteTarget(player); setInviteCopied(false); };
  const handleSendEmail = () => { if(!inviteTarget?.email) return; window.location.href = `mailto:${inviteTarget.email}?subject=Academy Access&body=${encodeURIComponent(getInviteMessage(inviteTarget))}`; };
  const handleCopyInvite = () => { if(!inviteTarget) return; navigator.clipboard.writeText(getInviteMessage(inviteTarget)); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-emerald-500"/></div>;

  if (isPlayerRole) {
      if (!viewPlayer) return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-slate-300"/></div>;
      return (
        <div className="min-h-screen bg-slate-50 pb-20 p-6 lg:p-10 max-w-4xl mx-auto">
             <div className="bg-white rounded-3xl shadow-xl overflow-hidden mb-8">
                 <div className="h-40 bg-gradient-to-r from-slate-900 to-slate-800 relative">
                     <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500 via-slate-900 to-black"></div>
                 </div>
                 <div className="px-8 pb-8 -mt-16 flex flex-col items-center relative z-10">
                     <div className="h-32 w-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100">
                         {formData.photoUrl ? <img src={formData.photoUrl} className="h-full w-full object-cover"/> : <div className="h-full w-full flex items-center justify-center text-4xl font-bold text-slate-300">{viewPlayer.name[0]}</div>}
                     </div>
                     <h1 className="text-3xl font-black text-slate-900 mt-4">{viewPlayer.name}</h1>
                     <div className="flex gap-2 mt-2">
                         <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold uppercase tracking-wider text-slate-600">{viewPlayer.level}</span>
                         <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold uppercase tracking-wider text-slate-600">{viewPlayer.age} Years</span>
                     </div>
                 </div>
             </div>
             <div className="text-center text-slate-500">Athlete dashboard active. Profile synchronized.</div>
        </div>
      );
  }

  return (
    <div className="p-8 lg:p-12 max-w-7xl mx-auto animate-fade-in pb-24">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-12 gap-6">
        <div>
            <h2 className="text-4xl font-black text-slate-900 tracking-tight">Roster</h2>
            <div className="flex items-center gap-3 mt-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">{players.length} Active Athletes</span>
            </div>
        </div>
        <button onClick={handleAddClick} className="bg-slate-950 hover:bg-slate-900 text-white px-8 py-4 rounded-2xl flex items-center gap-3 shadow-2xl shadow-slate-900/20 font-black transition-all active:scale-95 group text-sm uppercase tracking-widest">
            <Plus className="h-5 w-5 group-hover:rotate-90 transition-transform" /> 
            Add Athlete
        </button>
      </div>

      {/* Grid */}
      <div className="grid gap-6 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {players.map(player => (
        <div key={player.id} onClick={() => handleEdit(player)} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all duration-500 group cursor-pointer relative overflow-hidden flex flex-col h-full">
            <div className="p-6 flex flex-col items-center text-center flex-1">
                <div className="relative mb-6">
                    <div className="h-20 w-20 rounded-2xl bg-slate-50 border border-slate-100 overflow-hidden shadow-inner group-hover:scale-110 transition-transform duration-500 ring-4 ring-slate-50 group-hover:ring-emerald-50">
                        {player.photoUrl ? <img src={player.photoUrl} className="h-full w-full object-cover" referrerPolicy="no-referrer" /> : <div className="h-full w-full flex items-center justify-center text-slate-200 bg-slate-50"><User className="h-8 w-8"/></div>}
                    </div>
                    <div className={`absolute -bottom-1 -right-1 h-6 w-6 rounded-lg border-2 border-white flex items-center justify-center text-[8px] font-black shadow-lg ${
                        player.level === 'Elite' ? 'bg-amber-400 text-amber-950' : 
                        player.level === 'Advanced' ? 'bg-emerald-500 text-white' : 
                        player.level === 'Intermediate' ? 'bg-blue-500 text-white' : 'bg-slate-400 text-white'
                    }`}>
                        {player.level.charAt(0)}
                    </div>
                </div>
                <h3 className="font-black text-slate-900 text-base tracking-tight mb-0.5 group-hover:text-emerald-600 transition-colors line-clamp-1">{player.name}</h3>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">{player.ageCategory || player.level}</p>
                
                <div className="grid grid-cols-2 gap-2 w-full pt-4 border-t border-slate-50 mt-auto">
                    <div className="bg-slate-50/50 rounded-xl p-2 group-hover:bg-white transition-colors">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Age</div>
                        <div className="text-xs font-black text-slate-700">{player.age || '-'}</div>
                    </div>
                    <div className="bg-slate-50/50 rounded-xl p-2 group-hover:bg-white transition-colors">
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Hand</div>
                        <div className="text-xs font-black text-slate-700">{player.hand || '-'}</div>
                    </div>
                </div>
            </div>
            
            <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-50 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Profile</span>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(player); }} className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"><Trash2 className="h-3 w-3" /></button>
                    <div className="p-1.5 bg-white rounded-lg shadow-sm border border-slate-100"><ChevronRight className="h-3 w-3 text-emerald-500" /></div>
                </div>
            </div>
        </div>
        ))}
        <button onClick={handleAddClick} className="rounded-[2rem] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-3 min-h-[240px] hover:border-emerald-300 hover:bg-emerald-50/30 transition-all group text-slate-400 hover:text-emerald-600 active:scale-95">
            <div className="h-12 w-12 rounded-xl bg-slate-50 flex items-center justify-center group-hover:scale-110 group-hover:bg-emerald-100 group-hover:text-emerald-600 transition-all border border-slate-100 group-hover:border-emerald-200 shadow-sm"><Plus className="h-6 w-6"/></div>
            <span className="font-black text-[10px] uppercase tracking-widest">Add Athlete</span>
        </button>
      </div>

      {/* Edit Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-scale-in border border-white/10">
             <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-white/90 backdrop-blur-md z-10">
                <div>
                    <h3 className="font-black text-3xl text-slate-900 tracking-tighter">{currentPlayer ? 'Athlete Profile' : 'New Athlete'}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500"></div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{currentPlayer ? formData.name : 'Performance Tracking'}</p>
                    </div>
                </div>
                <button type="button" onClick={() => setIsEditing(false)} className="p-4 hover:bg-slate-100 rounded-[1.5rem] text-slate-400 hover:text-slate-900 transition-all"><X className="h-6 w-6"/></button>
             </div>
             
             <div className="flex-1 overflow-y-auto custom-scrollbar p-0">
                <div className="p-10 space-y-12">
                   <div className="flex flex-col lg:flex-row gap-12 items-start">
                      <div className="flex flex-col items-center gap-6 w-full lg:w-auto shrink-0">
                         <div className="h-48 w-48 rounded-[3rem] bg-slate-50 border border-slate-100 overflow-hidden relative group shadow-inner ring-8 ring-slate-50">
                            {formData.photoUrl ? <img src={formData.photoUrl} className="h-full w-full object-cover" referrerPolicy="no-referrer"/> : <User className="h-20 w-20 text-slate-200 m-auto top-1/2 relative -translate-y-1/2"/>}
                            <label className="absolute inset-0 bg-slate-900/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white text-[10px] font-black uppercase tracking-widest">
                                Change Photo
                                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden"/>
                            </label>
                         </div>
                         <div className="flex flex-col items-center gap-2">
                           <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                             formData.level === 'Elite' ? 'bg-amber-50 text-amber-600 border-amber-100' : 
                             formData.level === 'Advanced' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 
                             'bg-slate-50 text-slate-600 border-slate-100'
                           }`}>
                             {formData.level} Level
                           </span>
                         </div>
                      </div>
                      <div className="flex-1 space-y-8 w-full">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                             <div className="space-y-2">
                                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Full Name</label>
                                 <input required type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Athlete Name" />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Athlete Level</label>
                                <select className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none appearance-none" value={formData.level} onChange={e => setFormData({...formData, level: e.target.value})}>
                                  <option>Beginner</option><option>Intermediate</option><option>Advanced</option><option>Elite</option>
                                </select>
                             </div>
                         </div>
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Date of Birth</label>
                                <input type="date" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none" value={formData.dob} onChange={e => setFormData({...formData, dob: e.target.value, age: new Date().getFullYear() - new Date(e.target.value).getFullYear()})} />
                             </div>
                             <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email Address</label>
                                <input type="email" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="Login Email" />
                             </div>
                         </div>
                      </div>
                   </div>

                   <div className="space-y-8 pt-10 border-t border-slate-50">
                       <div className="flex gap-10 border-b border-slate-50 overflow-x-auto no-scrollbar">
                          {['profile', 'performance', 'competition', 'history'].map((tab) => (
                              <button key={tab} type="button" onClick={() => setActiveModalTab(tab as any)} className={`pb-5 text-[10px] font-black uppercase tracking-[0.2em] transition-all border-b-2 relative whitespace-nowrap ${activeModalTab===tab ? 'text-emerald-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                                  {tab}
                                  {activeModalTab === tab && <div className="absolute bottom-0 left-0 w-full h-1 bg-emerald-500 rounded-full shadow-[0_0_12px_rgba(16,185,129,0.4)]"></div>}
                              </button>
                          ))}
                       </div>
                       
                       <div className="min-h-[300px]">
                        {activeModalTab === 'profile' && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 animate-fade-in">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Gender</label>
                                    <select className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none" value={formData.gender || ''} onChange={e => setFormData({...formData, gender: e.target.value as any})}>
                                       <option value="">Select...</option><option value="Male">Male</option><option value="Female">Female</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Age Category</label>
                                    <select className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none" value={formData.ageCategory || ''} onChange={e => setFormData({...formData, ageCategory: e.target.value as any})}>
                                       <option value="">Select...</option>
                                       <option value="U11">U11</option>
                                       <option value="U13">U13</option>
                                       <option value="U15">U15</option>
                                       <option value="U17">U17</option>
                                       <option value="U19">U19</option>
                                       <option value="Open">Open</option>
                                    </select>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Playing Hand</label>
                                    <select className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none" value={formData.hand || ''} onChange={e => setFormData({...formData, hand: e.target.value as any})}>
                                       <option value="">Select...</option><option value="Right">Right</option><option value="Left">Left</option>
                                    </select>
                                 </div>
                                 <div className="sm:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Guardian Name</label>
                                    <input type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none" value={formData.parentName} onChange={e => setFormData({...formData, parentName: e.target.value})} placeholder="Parent/Guardian Name" />
                                 </div>
                                 <div className="sm:col-span-2 space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Contact Phone</label>
                                    <input type="tel" className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 transition-all font-bold text-slate-900 outline-none" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="Phone number" />
                                 </div>
                            </div>
                        )}

                        {activeModalTab === 'performance' && (
                            <div className="space-y-8 animate-fade-in">
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-emerald-600 uppercase tracking-widest ml-1">Strengths</label>
                                    <textarea className="w-full p-6 bg-emerald-50/30 border border-emerald-100 rounded-[2rem] text-sm font-semibold h-32 resize-none outline-none focus:ring-4 focus:ring-emerald-500/10 transition-all" value={formData.strength} onChange={e => setFormData({...formData, strength: e.target.value})} placeholder="Key technical/physical strengths..."></textarea>
                                 </div>
                                 <div className="space-y-2">
                                    <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest ml-1">Areas for Improvement</label>
                                    <textarea className="w-full p-6 bg-rose-50/30 border border-rose-100 rounded-[2rem] text-sm font-semibold h-32 resize-none outline-none focus:ring-4 focus:ring-rose-500/10 transition-all" value={formData.weakness} onChange={e => setFormData({...formData, weakness: e.target.value})} placeholder="Current focus areas..."></textarea>
                                 </div>
                                 <div className="flex justify-center">
                                  <button type="button" onClick={handleGeneratePlan} disabled={isGeneratingPlan} className="flex items-center gap-3 text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-8 py-4 rounded-2xl border border-indigo-100 hover:bg-indigo-100 transition-all disabled:opacity-50 shadow-sm active:scale-95">
                                      {isGeneratingPlan ? <Loader2 className="h-4 w-4 animate-spin"/> : <Sparkles className="h-4 w-4" />} Generate AI Growth Plan
                                  </button>
                                 </div>
                            </div>
                        )}
                        
                        {activeModalTab === 'competition' && (
                            <div className="animate-fade-in space-y-8">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-amber-500 uppercase tracking-widest ml-1">Achievements & Awards</label>
                                    <textarea className="w-full p-6 bg-amber-50/30 border border-amber-100 rounded-[2rem] text-sm font-semibold h-32 resize-none outline-none focus:ring-4 focus:ring-amber-500/10" value={formData.achievements} onChange={e => setFormData({...formData, achievements: e.target.value})} placeholder="Key tournament results and wins..."></textarea>
                                </div>
                                <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-3"><Trophy className="h-4 w-4 text-amber-500"/> Recent Tournament Performance</h4>
                                    <div className="space-y-3">
                                        {playerResults.length === 0 ? (
                                          <div className="py-10 text-center text-xs text-slate-400 font-bold uppercase tracking-widest italic">No tournament data found</div>
                                        ) : playerResults.slice(0,5).map(r => (
                                            <div key={r.id} className="flex justify-between items-center p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
                                                <div className="flex items-center gap-3">
                                                  <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                                                  <span className="text-sm font-black text-slate-700">{r.tournamentName}</span>
                                                </div>
                                                <span className="px-3 py-1 bg-slate-900 text-white text-[10px] font-black rounded-lg uppercase tracking-widest">{r.roundReached}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeModalTab === 'history' && (
                            <div className="animate-fade-in space-y-6">
                                <div className="flex items-center justify-between px-2">
                                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Training History</h4>
                                    <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">{trainingHistory.length} Sessions Logged</span>
                                </div>
                                <div className="space-y-4">
                                    {trainingHistory.length === 0 ? (
                                        <div className="py-20 text-center bg-slate-50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                                            <HistoryIcon className="h-12 w-12 text-slate-200 mx-auto mb-4" />
                                            <p className="text-xs text-slate-400 font-black uppercase tracking-widest">No previous training records</p>
                                        </div>
                                    ) : trainingHistory.map((h, idx) => (
                                        <div key={idx} className="bg-white border border-slate-100 rounded-[2rem] p-6 shadow-sm hover:shadow-xl hover:border-emerald-100 transition-all flex gap-6 group">
                                            <div className="flex flex-col items-center justify-center min-w-[75px] bg-slate-50 rounded-2xl border border-slate-100 p-3 shrink-0 group-hover:bg-emerald-50 group-hover:border-emerald-100 transition-colors">
                                                <span className="text-[10px] font-black text-slate-400 uppercase leading-none group-hover:text-emerald-600">{new Date(h.date).toLocaleDateString(undefined, {month:'short'})}</span>
                                                <span className="text-2xl font-black text-slate-900 leading-none my-1.5">{new Date(h.date).getDate()}</span>
                                                <span className="text-[10px] font-bold text-slate-500 leading-none">{new Date(h.date).toLocaleDateString(undefined, {weekday:'short'})}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h5 className="text-lg font-black text-slate-900 truncate tracking-tight">{h.description || 'Training Session'}</h5>
                                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${h.type === 'Technical' ? 'bg-blue-50 text-blue-600' : h.type === 'Tactical' ? 'bg-purple-50 text-purple-600' : 'bg-amber-50 text-amber-600'}`}>
                                                        {h.type}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-[11px] text-slate-400 font-bold mb-3">
                                                    <span className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-emerald-500/60"/> {h.startTime} - {h.endTime}</span>
                                                    {h.location && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5 text-emerald-500/60"/> {h.location}</span>}
                                                </div>
                                                {h.drills && (
                                                    <div className="bg-slate-50/50 rounded-2xl p-3 flex gap-3 group-hover:bg-white transition-colors">
                                                        <ClipboardList className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5"/>
                                                        <p className="text-xs text-slate-500 font-semibold line-clamp-2 leading-relaxed">{h.drills}</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                       </div>
                    </div>
                </div>
             </div>

             <div className="p-8 border-t border-slate-50 flex flex-col sm:flex-row justify-end gap-4 sticky bottom-0 bg-white/90 backdrop-blur-md">
                <button type="button" onClick={() => setIsEditing(false)} className="px-8 py-4 text-slate-500 font-black hover:bg-slate-50 rounded-2xl transition-all text-xs uppercase tracking-widest">Close</button>
                {formData.id && (
                    <button type="button" onClick={() => openInviteModal(formData)} className="px-8 py-4 bg-indigo-50 text-indigo-600 font-black rounded-2xl hover:bg-indigo-100 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-sm">
                        <Mail className="h-4 w-4"/> Send App Invite
                    </button>
                )}
                <button type="button" onClick={handleSubmit} className="px-10 py-4 bg-slate-950 text-white font-black rounded-2xl hover:bg-slate-900 shadow-2xl shadow-slate-900/20 transition-all active:scale-95 text-xs uppercase tracking-widest flex items-center justify-center gap-3">
                   <Save className="h-4 w-4"/> Save Profile
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Invitation Modal */}
      {inviteTarget && (
         <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
             <div className="bg-white rounded-[3rem] shadow-2xl max-w-md w-full overflow-hidden animate-scale-in p-10 border border-white/10">
                 <div className="text-center mb-8">
                     <div className="h-20 w-20 bg-indigo-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 text-indigo-500 shadow-inner">
                         <Mail className="h-10 w-10"/>
                     </div>
                     <h3 className="font-black text-2xl text-slate-900 tracking-tight">Send Invite</h3>
                     <p className="text-sm text-slate-500 mt-2 font-medium">Invite {inviteTarget.name} to view their progress via the mobile app.</p>
                 </div>
                 <div className="flex flex-col gap-4">
                     <button onClick={handleSendEmail} className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-xl shadow-indigo-500/30 text-xs uppercase tracking-widest transition-all active:scale-95">
                         <ExternalLink className="h-4 w-4"/> Open Mail App
                     </button>
                     <button onClick={handleCopyInvite} className="w-full py-5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-black rounded-2xl flex items-center justify-center gap-3 text-xs uppercase tracking-widest transition-all active:scale-95">
                         {inviteCopied ? <Check className="h-4 w-4 text-emerald-500"/> : <Copy className="h-4 w-4"/>}
                         {inviteCopied ? 'Link Copied' : 'Copy Invite Link'}
                     </button>
                     <button onClick={() => setInviteTarget(null)} className="w-full py-4 text-slate-400 font-black hover:text-slate-900 text-xs uppercase tracking-widest transition-colors">Cancel</button>
                 </div>
             </div>
         </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="bg-white rounded-[2.5rem] shadow-2xl max-w-sm w-full p-10 text-center animate-scale-in border border-white/10">
            <div className="h-16 w-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-rose-500 shadow-inner">
              <Trash2 className="h-8 w-8"/>
            </div>
            <h3 className="text-xl font-black text-slate-900 mb-3 tracking-tight">Delete {deleteTarget.name}?</h3>
            <p className="text-slate-500 mb-8 text-sm font-medium leading-relaxed">Removing this athlete will permanently delete all their training records and data.</p>
            <div className="flex flex-col gap-3">
              <button onClick={confirmDelete} className="w-full py-4 bg-rose-500 text-white font-black rounded-2xl hover:bg-rose-600 shadow-xl shadow-rose-500/30 text-xs uppercase tracking-widest transition-all active:scale-95">Delete Permanently</button>
              <button onClick={() => setDeleteTarget(null)} className="w-full py-4 text-slate-400 font-black hover:text-slate-900 text-xs uppercase tracking-widest transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
