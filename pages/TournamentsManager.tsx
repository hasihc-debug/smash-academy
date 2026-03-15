
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Trophy, MapPin, Calendar, ChevronRight } from 'lucide-react';
import { dbService } from '../utils/db';
import { appId } from '../utils/firebase';
import { User as FirebaseUser, Tournament, TournamentEntry, Player, TournamentLevel, RoundReached, ROUND_SCORES } from '../types';

interface TournamentsManagerProps {
  user: FirebaseUser;
}

export const TournamentsManager: React.FC<TournamentsManagerProps> = ({ user }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [entries, setEntries] = useState<TournamentEntry[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  
  // Modal States
  const [isEditingTournament, setIsEditingTournament] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState(false);
  
  // Forms
  const [tournamentForm, setTournamentForm] = useState<Partial<Tournament>>({ level: 'District' });
  const [entryForm, setEntryForm] = useState<Partial<TournamentEntry>>({ eventType: 'Singles', roundReached: 'R32' });

  // Initial Data Fetch
  useEffect(() => {
    if (!user) return;
    const unsubT = dbService.subscribeTournaments(user, appId, setTournaments);
    const unsubP = dbService.subscribePlayers(user, appId, (data) => setPlayers(data.sort((a:any,b:any) => a.name.localeCompare(b.name))));
    return () => { unsubT(); unsubP(); };
  }, [user]);

  // Fetch Entries when Tournament Selected
  useEffect(() => {
    if (!user || !selectedTournament) return;
    const unsubE = dbService.subscribeTournamentEntries(user, appId, selectedTournament.id, setEntries);
    return () => unsubE();
  }, [user, selectedTournament]);

  // --- Handlers ---

  const handleSaveTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournamentForm.name || !tournamentForm.startDate) return;
    const id = tournamentForm.id || crypto.randomUUID();
    const payload = {
        ...tournamentForm,
        id,
        createdAt: tournamentForm.createdAt || new Date().toISOString()
    } as Tournament;
    await dbService.saveTournament(user, appId, payload);
    setIsEditingTournament(false);
    setTournamentForm({ level: 'District' });
  };

  const handleDeleteTournament = async (id: string) => {
    if (confirm('Delete this tournament? This will not delete player result records linked to it automatically.')) {
        await dbService.deleteTournament(user, appId, id);
        if (selectedTournament?.id === id) setSelectedTournament(null);
    }
  };

  const handleEditEntry = (entry: TournamentEntry) => {
      setEntryForm(entry);
      setShowEntryModal(true);
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament || !entryForm.playerId) return;
    const id = entryForm.id || crypto.randomUUID();
    const payload = {
        ...entryForm,
        id,
        tournamentId: selectedTournament.id,
        createdAt: entryForm.createdAt || new Date().toISOString()
    } as TournamentEntry;
    await dbService.saveTournamentEntry(user, appId, payload);
    setShowEntryModal(false);
    setEntryForm({ eventType: 'Singles', roundReached: 'R32' });
  };

  const handleDeleteEntry = async (id: string) => {
    if (confirm('Remove this result?')) {
        await dbService.deleteTournamentEntry(user, appId, id);
    }
  };

  // Sort entries by performance (Round Reached)
  const sortedEntries = [...entries].sort((a, b) => {
      const scoreA = ROUND_SCORES[a.roundReached] || 0;
      const scoreB = ROUND_SCORES[b.roundReached] || 0;
      if (scoreA !== scoreB) return scoreB - scoreA; // Higher score first
      const playerA = players.find(p => p.id === a.playerId)?.name || '';
      const playerB = players.find(p => p.id === b.playerId)?.name || '';
      return playerA.localeCompare(playerB);
  });

  // --- UI Components ---

  // 1. List View
  if (!selectedTournament) {
    return (
      <div className="p-6 lg:p-12 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-12">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
            <div className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20">
                        <Trophy className="h-5 w-5 text-amber-600" />
                    </div>
                    <span className="text-[10px] font-black text-amber-600 uppercase tracking-[0.3em]">Competitions</span>
                </div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tight">
                    Tournaments
                </h2>
                <p className="text-slate-400 font-bold text-sm max-w-md leading-relaxed">
                    Track athlete performance across local, national, and international competitions.
                </p>
            </div>
            <button 
                onClick={() => { setTournamentForm({ level: 'District' }); setIsEditingTournament(true); }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-5 rounded-[2rem] flex items-center gap-3 shadow-2xl shadow-slate-900/20 font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 group"
            >
                <Plus className="h-4 w-4 stroke-[4] group-hover:rotate-90 transition-transform duration-300" /> 
                Add Tournament
            </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100">
                            <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Tournament</th>
                            <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Schedule</th>
                            <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Level</th>
                            <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Location</th>
                            <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {tournaments.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-32 text-center">
                                    <div className="flex flex-col items-center gap-6">
                                        <div className="h-20 w-20 bg-slate-50 rounded-[2rem] flex items-center justify-center border border-slate-100 shadow-inner">
                                            <Trophy className="h-10 w-10 text-slate-200" />
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-slate-900 font-black text-lg">No tournaments yet</p>
                                            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest">Start by adding your first competition</p>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ) : tournaments.map(t => (
                            <tr 
                                key={t.id} 
                                onClick={() => setSelectedTournament(t)} 
                                className="hover:bg-slate-50/80 cursor-pointer group transition-all duration-500"
                            >
                                <td className="px-10 py-8">
                                    <div className="flex items-center gap-5">
                                        <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-500 group-hover:scale-110 group-hover:bg-amber-500 group-hover:text-white transition-all duration-500 shadow-sm">
                                            <Trophy className="h-6 w-6" />
                                        </div>
                                        <span className="font-black text-slate-900 text-base group-hover:text-amber-600 transition-colors">{t.name}</span>
                                    </div>
                                </td>
                                <td className="px-10 py-8">
                                    <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
                                        <Calendar className="h-4 w-4 text-slate-300"/>
                                        {new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </div>
                                </td>
                                <td className="px-10 py-8">
                                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border shadow-sm ${
                                        t.level === 'International' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        t.level === 'National' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                        t.level === 'District' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                        'bg-slate-50 text-slate-500 border-slate-100'
                                    }`}>{t.level}</span>
                                </td>
                                <td className="px-10 py-8 text-sm font-bold text-slate-400">
                                    <div className="flex items-center gap-3">
                                        <MapPin className="h-4 w-4 text-slate-300"/>
                                        {t.location || 'TBD'}
                                    </div>
                                </td>
                                <td className="px-10 py-8 text-right">
                                    <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setTournamentForm(t); setIsEditingTournament(true); }} 
                                            className="p-3 hover:bg-white rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm border border-transparent hover:border-slate-100 transition-all"
                                        >
                                            <Edit2 className="h-4 w-4"/>
                                        </button>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteTournament(t.id); }} 
                                            className="p-3 hover:bg-rose-50 rounded-2xl text-slate-300 hover:text-rose-500 transition-all"
                                        >
                                            <Trash2 className="h-4 w-4"/>
                                        </button>
                                        <div className="h-10 w-[1px] bg-slate-100 mx-2"></div>
                                        <div className="p-3 bg-slate-50 rounded-2xl text-slate-300 group-hover:text-slate-900 transition-colors">
                                            <ChevronRight className="h-5 w-5"/>
                                        </div>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Create/Edit Modal */}
        {isEditingTournament && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xl p-4 animate-in fade-in duration-500">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-12 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 border border-slate-100">
                    <div className="flex justify-between items-start mb-10">
                        <div className="space-y-2">
                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                                {tournamentForm.id ? 'Edit' : 'New'} Tournament
                            </h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Competition Configuration</p>
                        </div>
                        <button 
                            onClick={() => setIsEditingTournament(false)} 
                            className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:rotate-90 duration-300"
                        >
                            <Plus className="h-8 w-8 rotate-45"/>
                        </button>
                    </div>

                    <form onSubmit={handleSaveTournament} className="space-y-10">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Tournament Name</label>
                            <input 
                                required 
                                type="text" 
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                value={tournamentForm.name || ''} 
                                onChange={e => setTournamentForm({...tournamentForm, name: e.target.value})} 
                                placeholder="e.g. State Championship" 
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Start Date</label>
                                <input 
                                    required 
                                    type="date" 
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                    value={tournamentForm.startDate || ''} 
                                    onChange={e => setTournamentForm({...tournamentForm, startDate: e.target.value})} 
                                />
                            </div>
                             <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">End Date (Opt)</label>
                                <input 
                                    type="date" 
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                    value={tournamentForm.endDate || ''} 
                                    onChange={e => setTournamentForm({...tournamentForm, endDate: e.target.value})} 
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Level</label>
                                <select 
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none" 
                                    value={tournamentForm.level} 
                                    onChange={e => setTournamentForm({...tournamentForm, level: e.target.value as TournamentLevel})}
                                >
                                    <option>Club</option><option>District</option><option>National</option><option>International</option>
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Location</label>
                                <input 
                                    type="text" 
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                    value={tournamentForm.location || ''} 
                                    onChange={e => setTournamentForm({...tournamentForm, location: e.target.value})} 
                                    placeholder="City, Venue" 
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-6 pt-6">
                            <button 
                                type="button" 
                                onClick={() => setIsEditingTournament(false)} 
                                className="px-10 py-5 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:text-slate-900 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="px-12 py-5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-[2rem] hover:bg-slate-800 shadow-2xl shadow-slate-900/20 transition-all active:scale-95"
                            >
                                Save Tournament
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
      </div>
    );
  }

  // 2. Detail View
  return (
    <div className="p-6 lg:p-12 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 space-y-12">
        {/* Header */}
        <div className="space-y-8">
            <button 
                onClick={() => setSelectedTournament(null)} 
                className="text-[10px] font-black text-slate-400 hover:text-slate-900 flex items-center gap-3 uppercase tracking-[0.2em] transition-all group"
            >
                <div className="p-2 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                    <ChevronRight className="h-3 w-3 rotate-180"/> 
                </div>
                Back to tournaments
            </button>
            
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-tight">{selectedTournament.name}</h2>
                        <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border shadow-sm h-fit ${
                                        selectedTournament.level === 'International' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                                        selectedTournament.level === 'National' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                                        selectedTournament.level === 'District' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                                        'bg-slate-50 text-slate-500 border-slate-100'
                        }`}>{selectedTournament.level}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-8 text-sm text-slate-400 font-bold uppercase tracking-widest">
                        <span className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-amber-500"/> 
                            {new Date(selectedTournament.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                        {selectedTournament.location && (
                            <span className="flex items-center gap-3">
                                <MapPin className="h-4 w-4 text-rose-500"/> 
                                {selectedTournament.location}
                            </span>
                        )}
                    </div>
                </div>
                <button 
                    onClick={() => { setEntryForm({ eventType: 'Singles', roundReached: 'R32' }); setShowEntryModal(true); }}
                    className="bg-slate-900 hover:bg-slate-800 text-white px-10 py-5 rounded-[2rem] flex items-center gap-3 shadow-2xl shadow-slate-900/20 font-black text-[10px] uppercase tracking-[0.2em] transition-all active:scale-95 group"
                >
                    <Plus className="h-4 w-4 stroke-[4] group-hover:rotate-90 transition-transform duration-300" /> 
                    Add Result
                </button>
            </div>
        </div>

        {/* Results Table */}
        <div className="bg-white rounded-[3rem] shadow-2xl shadow-slate-200/40 border border-slate-100 overflow-hidden">
            <div className="px-10 py-8 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Athlete Performance ({sortedEntries.length})</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-white border-b border-slate-50">
                            <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Athlete</th>
                            <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Event</th>
                            <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Result</th>
                            <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Notes</th>
                            <th className="px-10 py-8 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {sortedEntries.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-32 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                                            <Trophy className="h-8 w-8 text-slate-200" />
                                        </div>
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-xs italic">No results recorded yet.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : sortedEntries.map(entry => {
                            const player = players.find(p => p.id === entry.playerId);
                            return (
                                <tr key={entry.id} className="hover:bg-slate-50/50 transition-all duration-500 group">
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-5">
                                            <div className="h-14 w-14 rounded-2xl bg-slate-100 flex items-center justify-center text-xs font-black text-slate-400 overflow-hidden border border-slate-200 shadow-inner group-hover:scale-105 transition-transform duration-500">
                                                {player?.photoUrl ? (
                                                    <img src={player.photoUrl} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                                                ) : (
                                                    <span className="text-lg">{player?.name.charAt(0) || '?'}</span>
                                                )}
                                            </div>
                                            <span className="font-black text-slate-900 text-base">{player?.name || 'Unknown Player'}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] bg-slate-50 px-4 py-1.5 rounded-full border border-slate-100">{entry.eventType}</span>
                                    </td>
                                    <td className="px-10 py-8">
                                        <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border shadow-sm flex items-center gap-2 w-fit ${
                                            entry.roundReached === 'CHAMPION' ? 'bg-amber-500 text-white border-amber-500 shadow-amber-200' :
                                            entry.roundReached === 'F' ? 'bg-slate-900 text-white border-slate-900 shadow-slate-200' :
                                            entry.roundReached === 'SF' ? 'bg-orange-50 text-orange-700 border-orange-100' :
                                            'bg-white border-slate-100 text-slate-400'
                                        }`}>
                                            {entry.roundReached === 'CHAMPION' ? <Trophy className="h-3.5 w-3.5"/> : null}
                                            {entry.roundReached === 'CHAMPION' ? 'Winner' : entry.roundReached}
                                        </span>
                                    </td>
                                    <td className="px-10 py-8 text-sm font-bold text-slate-400 max-w-xs truncate">{entry.notes || '-'}</td>
                                    <td className="px-10 py-8 text-right">
                                        <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all translate-x-4 group-hover:translate-x-0">
                                            <button 
                                                onClick={() => handleEditEntry(entry)} 
                                                className="p-3 hover:bg-white rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm border border-transparent hover:border-slate-100 transition-all"
                                            >
                                                <Edit2 className="h-4 w-4"/>
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteEntry(entry.id)} 
                                                className="p-3 hover:bg-rose-50 rounded-2xl text-slate-300 hover:text-rose-500 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4"/>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Add Entry Modal */}
        {showEntryModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xl p-4 animate-in fade-in duration-500">
                <div className="bg-white rounded-[3rem] shadow-2xl w-full max-w-xl p-12 animate-in zoom-in-95 slide-in-from-bottom-8 duration-500 border border-slate-100">
                    <div className="flex justify-between items-start mb-10">
                        <div className="space-y-2">
                            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                                {entryForm.id ? 'Edit Result' : 'Add Result'}
                            </h3>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Performance Record</p>
                        </div>
                        <button 
                            onClick={() => setShowEntryModal(false)} 
                            className="p-3 hover:bg-slate-50 rounded-2xl text-slate-400 hover:text-slate-900 transition-all hover:rotate-90 duration-300"
                        >
                            <Plus className="h-8 w-8 rotate-45"/>
                        </button>
                    </div>

                    <form onSubmit={handleSaveEntry} className="space-y-10">
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Select Athlete</label>
                            <select 
                                required 
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none disabled:opacity-50" 
                                value={entryForm.playerId || ''} 
                                onChange={e => setEntryForm({...entryForm, playerId: e.target.value})}
                                disabled={!!entryForm.id}
                            >
                                <option value="">-- Choose Athlete --</option>
                                {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Event Type</label>
                                <select 
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none" 
                                    value={entryForm.eventType} 
                                    onChange={e => setEntryForm({...entryForm, eventType: e.target.value as any})}
                                >
                                    <option>Singles</option><option>Doubles</option><option>Mixed</option>
                                </select>
                            </div>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Round Reached</label>
                                <select 
                                    className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 font-bold text-slate-900 focus:ring-2 focus:ring-amber-500/20 transition-all appearance-none" 
                                    value={entryForm.roundReached} 
                                    onChange={e => setEntryForm({...entryForm, roundReached: e.target.value as RoundReached})}
                                >
                                    <option value="R64">R64</option>
                                    <option value="R32">R32</option>
                                    <option value="R16">R16 (Pre-QF)</option>
                                    <option value="QF">Quarter-Final</option>
                                    <option value="SF">Semi-Final</option>
                                    <option value="F">Finalist</option>
                                    <option value="CHAMPION">Winner</option>
                                </select>
                            </div>
                        </div>
                        <div className="space-y-3">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Notes (Optional)</label>
                            <input 
                                type="text" 
                                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-5 font-bold text-slate-900 placeholder:text-slate-300 focus:ring-2 focus:ring-amber-500/20 transition-all" 
                                value={entryForm.notes || ''} 
                                onChange={e => setEntryForm({...entryForm, notes: e.target.value})} 
                                placeholder="e.g. Lost 21-19 in 3rd set" 
                            />
                        </div>
                        <div className="flex justify-end gap-6 pt-6">
                            <button 
                                type="button" 
                                onClick={() => setShowEntryModal(false)} 
                                className="px-10 py-5 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:text-slate-900 transition-all"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit" 
                                className="px-12 py-5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-[0.2em] rounded-[2rem] hover:bg-slate-800 shadow-2xl shadow-slate-900/20 transition-all active:scale-95"
                            >
                                Save Result
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}
    </div>
  );
};
