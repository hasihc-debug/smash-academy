
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Wallet, IndianRupee, CreditCard, Search, Plus, X, History, 
  CheckCircle2, Clock, ChevronRight, ExternalLink, Users, Star, Trash2, Edit3, SaveAll, Banknote as CashIcon, Send
} from 'lucide-react';
import { dbService } from '../utils/db';
import { appId } from '../utils/firebase';
import { User as FirebaseUser, Player, StudentPayment, CoachSalary, ELITE_PRICES, KIDS_PRICES, EXTRA_SESSION_PRICE } from '../types';

interface FinanceManagerProps {
  user: FirebaseUser;
  setActiveTab: (tab: string) => void;
}

export const FinanceManager: React.FC<FinanceManagerProps> = ({ user, setActiveTab }) => {
  const [activeTab, setActiveTabLocal] = useState<'fees' | 'salaries'>('fees');
  const [players, setPlayers] = useState<Player[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [salaries, setSalaries] = useState<CoachSalary[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewingMonth, setViewingMonth] = useState(new Date().getMonth());
  const [viewingYear, setViewingYear] = useState(new Date().getFullYear());

  // Modal States
  const [editingPaymentPlayer, setEditingPaymentPlayer] = useState<Player | null>(null);
  const [localEditPlayer, setLocalEditPlayer] = useState<Player | null>(null);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [salaryForm, setSalaryForm] = useState<Partial<CoachSalary>>({
    method: 'Cash', groupSessions: 0, individualSessions: 0, groupRate: 500, individualRate: 1000, date: new Date().toISOString().split('T')[0], amount: 0, status: 'paid'
  });

  const [loading, setLoading] = useState(true);

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  useEffect(() => {
    if (!user) return;
    
    const unsubPlayers = dbService.subscribePlayers(user, appId, (data) => {
      setPlayers(data);
      setLoading(false);
    });
    const unsubPayments = dbService.subscribePayments(user, appId, viewingMonth, viewingYear, setPayments);
    const unsubSalaries = dbService.subscribeSalaries(user, appId, viewingMonth, viewingYear, setSalaries);
    
    return () => { unsubPlayers(); unsubPayments(); unsubSalaries(); };
  }, [user, viewingMonth, viewingYear]);

  // Handle opening the modal
  const openBillingModal = (player: Player) => {
    setEditingPaymentPlayer(player);
    setLocalEditPlayer({ ...player });
    const existingPayment = payments.find(p => p.playerId === player.id);
    if (existingPayment) {
      setPaymentDate(existingPayment.date);
    } else {
      setPaymentDate(new Date().toISOString().split('T')[0]);
    }
  };

  const closeBillingModal = useCallback(() => {
    setEditingPaymentPlayer(null);
    setLocalEditPlayer(null);
  }, []);

  // Internal calculation for UI feedback
  const calculateFeesForPlayer = (p: Player) => {
    if (!p) return 0;
    const freq = p.sessionFrequency || 1;
    let basePrice = 0;

    if (p.customFrequencyRates && p.customFrequencyRates[freq]) {
        basePrice = p.customFrequencyRates[freq];
    } else if (p.groupSessionRateOverride !== undefined && p.groupSessionRateOverride > 0) {
        basePrice = p.groupSessionRateOverride;
    } else {
        const basePrices = p.pricingTier === 'Kids' ? KIDS_PRICES : ELITE_PRICES;
        basePrice = basePrices[freq] || basePrices[1] || 0;
    }
    
    const extraSessions = p.extraSessions || 0;
    const extraRate = p.extraSessionRateOverride ?? EXTRA_SESSION_PRICE;
    const individualSessions = p.individualSessionsCount || 0;
    const individualRate = p.individualSessionRate || 0;
    
    return basePrice + (extraSessions * extraRate) + (individualSessions * individualRate);
  };

  const handleLocalUpdate = (updates: Partial<Player>) => {
    if (!localEditPlayer) return;
    const updated = { ...localEditPlayer, ...updates };
    updated.monthlyFee = calculateFeesForPlayer(updated);
    setLocalEditPlayer(updated);
  };

  const handleSavePlayerConfig = async () => {
    if (!localEditPlayer || !user) return;
    try {
      const finalFee = calculateFeesForPlayer(localEditPlayer);
      const playerToSave = { ...localEditPlayer, monthlyFee: finalFee };
      await dbService.savePlayer(user, appId, playerToSave);
      closeBillingModal();
    } catch (error: any) {
      console.error("Save error:", error);
      alert(`Failed to save plan configuration: ${error.message || 'Check your internet or permissions.'}`);
    }
  };

  const updateCustomRate = (freq: number, newRate: number) => {
      if (!localEditPlayer) return;
      const customRates = { ...(localEditPlayer.customFrequencyRates || {}) };
      customRates[freq] = newRate;
      handleLocalUpdate({ customFrequencyRates: customRates });
  };

  const getFreqRate = (player: Player, freq: number) => {
      if (player.customFrequencyRates && player.customFrequencyRates[freq]) return player.customFrequencyRates[freq];
      const defaults = player.pricingTier === 'Kids' ? KIDS_PRICES : ELITE_PRICES;
      return defaults[freq] || 0;
  };

  const addCustomFrequencyRow = () => {
      if (!localEditPlayer) return;
      const existingFreqs = Object.keys(localEditPlayer.customFrequencyRates || {}).map(Number);
      const standardFreqs = localEditPlayer.pricingTier === 'Kids' ? [1,2] : [1,2,3,4,5];
      const allFreqs = [...new Set([...existingFreqs, ...standardFreqs])].sort((a,b) => a-b);
      const nextFreq = (allFreqs[allFreqs.length - 1] || 0) + 1;
      
      const customRates = { ...(localEditPlayer.customFrequencyRates || {}) };
      const lastRate = getFreqRate(localEditPlayer, allFreqs[allFreqs.length - 1] || 1);
      customRates[nextFreq] = lastRate + 2000;
      
      handleLocalUpdate({ customFrequencyRates: customRates });
  };

  const handleRecordPayment = async (player: Player, amount: number, method: 'Cash' | 'Bank Transfer', ref?: string) => {
    if (!user || !player) return;
    try {
      const paymentId = `${player.id}_${viewingMonth}_${viewingYear}`;
      
      // Constructing payment object, explicitly excluding undefined values
      const payment: StudentPayment = {
        id: paymentId,
        playerId: player.id,
        playerName: player.name,
        amount,
        month: viewingMonth,
        year: viewingYear,
        date: paymentDate,
        method,
        status: 'paid',
        frequency: player.sessionFrequency || 1,
        extraSessions: player.extraSessions || 0,
        extraSessionRate: player.extraSessionRateOverride || EXTRA_SESSION_PRICE,
        userId: user.uid
      };
      
      // Only set reference if it's provided as a non-empty string
      if (ref && ref.trim()) {
        payment.reference = ref;
      }

      // Sync player profile with latest data from modal to ensure plan consistency
      if (localEditPlayer) {
          const finalFee = calculateFeesForPlayer(localEditPlayer);
          await dbService.savePlayer(user, appId, { ...localEditPlayer, monthlyFee: finalFee });
      }

      // Record the actual payment
      await dbService.savePayment(user, appId, payment);
      
      // Clear states and close modal immediately upon success
      closeBillingModal();
    } catch (error: any) {
      console.error("Payment error:", error);
      // Alert the user with more context to help debugging
      alert(`Failed to record payment: ${error.message || 'Check database rules or connection.'}`);
    }
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salaryForm.coachName || salaryForm.amount === undefined) return;
    const salary: CoachSalary = {
      ...salaryForm,
      id: salaryForm.id || crypto.randomUUID(),
      month: viewingMonth,
      year: viewingYear,
      userId: user.uid,
      status: salaryForm.status || 'paid'
    } as CoachSalary;
    await dbService.saveSalary(user, appId, salary);
    setIsSalaryModalOpen(false);
    setSalaryForm({ method: 'Cash', groupSessions: 0, individualSessions: 0, groupRate: 500, individualRate: 1000, date: new Date().toISOString().split('T')[0], amount: 0, status: 'paid' });
  };

  const toggleSalaryStatus = async (salary: CoachSalary) => {
      const updated = { ...salary, status: salary.status === 'paid' ? 'pending' : 'paid' } as CoachSalary;
      await dbService.saveSalary(user, appId, updated);
  };

  const handleDeleteSalary = async (id: string) => {
      if (confirm("Delete this salary record?")) {
          await dbService.deleteSalary(user, appId, id);
      }
  };

  const filteredPlayers = players.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalCollections = payments.reduce((acc, p) => acc + p.amount, 0);
  const paidSalaries = salaries.filter(s => s.status === 'paid').reduce((acc, s) => acc + s.amount, 0);
  const pendingSalaries = salaries.filter(s => s.status === 'pending').reduce((acc, s) => acc + s.amount, 0);

  return (
    <div className="p-6 lg:p-12 max-w-7xl mx-auto animate-fade-in pb-20 space-y-12 bg-[#F8FAFC]">
      
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8">
        <div className="flex-1">
          <h1 className="text-4xl font-light text-slate-900 tracking-tight mb-2">
            Finance <span className="font-serif italic text-slate-400">Hub</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">Manage academy revenue, expenses, and coach payroll.</p>
          
          <div className="flex items-center gap-1 mt-6 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm w-fit">
            <button 
              onClick={() => {
                if (viewingMonth === 0) {
                  setViewingMonth(11);
                  setViewingYear(y => y - 1);
                } else {
                  setViewingMonth(m => m - 1);
                }
              }} 
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
            >
              <ChevronRight className="h-5 w-5 rotate-180"/>
            </button>
            <div className="px-6 flex flex-col items-center min-w-[160px]">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-0.5">Active Period</span>
              <span className="text-sm font-bold text-slate-900">{months[viewingMonth]} {viewingYear}</span>
            </div>
            <button 
              onClick={() => {
                if (viewingMonth === 11) {
                  setViewingMonth(0);
                  setViewingYear(y => y + 1);
                } else {
                  setViewingMonth(m => m + 1);
                }
              }} 
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
            >
              <ChevronRight className="h-5 w-5"/>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
          <div className="bg-white rounded-3xl p-8 flex flex-col items-start min-w-[200px] border border-slate-200 shadow-xl shadow-slate-200/40 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors">
              <Wallet className="h-16 w-16" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 relative z-10">Total Revenue</span>
            <span className="text-3xl font-black text-slate-900 flex items-center gap-1 relative z-10">
              <IndianRupee className="h-6 w-6 text-emerald-500 opacity-60"/>{totalCollections.toLocaleString()}
            </span>
          </div>
          <div className="bg-white rounded-3xl p-8 flex flex-col items-start min-w-[200px] border border-slate-200 shadow-xl shadow-slate-200/40 group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 text-rose-500/5 group-hover:text-rose-500/10 transition-colors">
              <CashIcon className="h-16 w-16" />
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3 relative z-10">Total Expenses</span>
            <span className="text-3xl font-black text-slate-900 flex items-center gap-1 relative z-10">
              <IndianRupee className="h-6 w-6 text-rose-500 opacity-60"/>{paidSalaries.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-12 border-b border-slate-200">
        <button 
          onClick={() => setActiveTabLocal('fees')} 
          className={`pb-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'fees' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Athlete Registry
          {activeTab === 'fees' && <div className="absolute bottom-0 inset-x-0 h-1 bg-emerald-500 rounded-t-full"></div>}
        </button>
        <button 
          onClick={() => setActiveTabLocal('salaries')} 
          className={`pb-5 text-[11px] font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'salaries' ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Coach Payroll
          {activeTab === 'salaries' && <div className="absolute bottom-0 inset-x-0 h-1 bg-emerald-500 rounded-t-full"></div>}
        </button>
      </div>

      {activeTab === 'fees' ? (
        <div className="space-y-8">
          <div className="flex flex-col sm:flex-row gap-6 items-center justify-between">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-300" />
              <input 
                type="text" 
                placeholder="Search athletes..." 
                className="w-full pl-14 pr-6 py-4 bg-white border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-emerald-500/5 outline-none shadow-sm transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="px-8 py-4 bg-slate-900 text-white rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all hover:bg-slate-800">
              <Send className="h-4 w-4"/> Send Payment Alerts
            </button>
          </div>

          <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/40 border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-0">
                <thead className="bg-slate-50/50 backdrop-blur-md">
                  <tr>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Athlete</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">Active Plan</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center border-b border-slate-100">Amount Due</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-center border-b border-slate-100">Status</th>
                    <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] text-right border-b border-slate-100">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Loading Registry...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPlayers.map(p => {
                    const payment = payments.find(pay => pay.playerId === p.id);
                    const isPaid = !!payment;
                    const amountDue = p.monthlyFee || 0;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-all duration-300 group">
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-slate-100 flex items-center justify-center font-black text-slate-400 overflow-hidden shrink-0 border border-slate-200 shadow-inner group-hover:scale-105 transition-transform">
                              {p.photoUrl ? <img src={p.photoUrl} className="h-full w-full object-cover" referrerPolicy="no-referrer"/> : p.name[0]}
                            </div>
                            <div className="min-w-0">
                              <button 
                                onClick={() => setActiveTab('players')}
                                className="text-sm font-black text-slate-900 hover:text-emerald-600 transition-colors truncate flex items-center gap-2"
                              >
                                {p.name}
                                <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-all translate-x-[-4px] group-hover:translate-x-0" />
                              </button>
                              <div className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mt-0.5">{p.level}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex items-center gap-3 group/plan">
                            <div className="flex flex-col gap-1.5">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${p.pricingTier === 'Kids' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'}`}>
                                  {p.pricingTier || 'Elite'}
                                </span>
                                <span className="text-xs font-black text-slate-700">{p.sessionFrequency || 1} Sessions / Wk</span>
                              </div>
                            </div>
                            <button 
                              onClick={() => openBillingModal(p)}
                              className="p-2 hover:bg-slate-100 rounded-xl text-slate-300 hover:text-slate-600 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-center">
                          <div className="text-sm font-black text-slate-900 flex items-center justify-center gap-1.5">
                            <IndianRupee className="h-3.5 w-3.5 text-slate-300"/>{amountDue.toLocaleString()}
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex justify-center">
                            {isPaid ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 border border-emerald-100 shadow-sm">
                                  <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]"/> Paid
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{payment.date}</span>
                              </div>
                            ) : (
                              <span className="px-4 py-1.5 bg-amber-50 text-amber-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.15em] flex items-center gap-2 border border-amber-100 shadow-sm">
                                <Clock className="h-3.5 w-3.5 stroke-[3]"/> Pending
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <button 
                            onClick={() => openBillingModal(p)}
                            className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95 ${isPaid ? 'bg-slate-50 text-slate-600 hover:bg-slate-100' : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'}`}
                          >
                            {isPaid ? "Manage" : "Collect"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div>
              <h3 className="font-black text-slate-900 uppercase tracking-[0.2em] text-xs flex items-center gap-3">
                <History className="h-5 w-5 text-emerald-500" />
                Salary Log: {months[viewingMonth]} {viewingYear}
              </h3>
              <p className="text-[10px] font-bold text-rose-500 mt-2 uppercase tracking-widest">Pending Payouts: ₹{pendingSalaries.toLocaleString()}</p>
            </div>
            <button onClick={() => setIsSalaryModalOpen(true)} className="px-8 py-4 bg-slate-900 text-white rounded-2xl flex items-center gap-3 text-xs font-black uppercase tracking-widest shadow-xl shadow-slate-900/20 active:scale-95 transition-all hover:bg-slate-800">
              <Plus className="h-5 w-5 stroke-[3]"/> New Disbursement
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {salaries.map(s => (
              <div key={s.id} className="bg-white rounded-3xl p-8 relative overflow-hidden group hover:shadow-2xl transition-all duration-500 border border-slate-200 shadow-xl shadow-slate-200/40">
                <div className="absolute top-0 right-0 p-6 text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors pointer-events-none">
                  <CreditCard className="h-24 w-24" />
                </div>
                <div className="flex justify-between items-start mb-8 relative z-10">
                  <div className="flex items-center gap-4">
                    <div className="h-14 w-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-500 font-black text-xl border border-indigo-100 shadow-sm group-hover:scale-110 transition-transform">{s.coachName[0]}</div>
                    <div>
                      <h4 className="font-black text-slate-900 text-lg">{s.coachName}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{s.date}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <button onClick={() => { setSalaryForm(s); setIsSalaryModalOpen(true); }} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-600 transition-all"><Edit3 className="h-4 w-4"/></button>
                    <button onClick={() => handleDeleteSalary(s.id)} className="p-2 hover:bg-rose-50 rounded-xl text-slate-300 hover:text-rose-500 transition-all"><Trash2 className="h-4 w-4"/></button>
                  </div>
                </div>
                <div className="space-y-4 mb-8 relative z-10">
                  <div className="flex justify-between items-end pt-4 border-t border-slate-100">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Final Payout</span>
                    <span className="text-2xl font-black text-emerald-600 flex items-center gap-1.5"><IndianRupee className="h-5 w-5 opacity-50"/>{s.amount.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between relative z-10">
                  <button 
                    onClick={() => toggleSalaryStatus(s)}
                    className={`px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] border transition-all active:scale-95 ${s.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'}`}
                  >
                    {s.status === 'paid' ? 'PAID' : 'PENDING'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Athlete Billing Modal */}
      {editingPaymentPlayer && localEditPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-300 max-h-[95vh] flex flex-col border border-slate-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
              <div>
                <h3 className="text-2xl font-light text-slate-900 tracking-tight">
                  Billing <span className="font-serif italic text-slate-400">Setup</span>
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{localEditPlayer.name}</span>
                  <div className="h-1 w-1 rounded-full bg-slate-200"></div>
                  <button onClick={() => setActiveTab('players')} className="text-[10px] text-emerald-500 font-black uppercase tracking-widest hover:text-emerald-600 flex items-center gap-1 transition-colors">
                    View Profile <ExternalLink className="h-3 w-3" />
                  </button>
                </div>
              </div>
              <button onClick={closeBillingModal} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><X className="h-6 w-6"/></button>
            </div>

              <div className="p-8 space-y-10 overflow-y-auto custom-scrollbar pb-32">
                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Payment Date</label>
                  <input 
                    type="date"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    value={paymentDate}
                    onChange={e => setPaymentDate(e.target.value)}
                  />
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Academy Tier</label>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => handleLocalUpdate({ pricingTier: 'Elite' })}
                    className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${localEditPlayer.pricingTier !== 'Kids' ? 'bg-slate-900 border-slate-900 text-white shadow-xl shadow-slate-900/20' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <Star className={`h-6 w-6 ${localEditPlayer.pricingTier !== 'Kids' ? 'text-amber-400' : 'text-slate-200'}`} />
                    <span className="text-xs font-black uppercase tracking-widest">Elite Academy</span>
                  </button>
                  <button 
                    onClick={() => handleLocalUpdate({ pricingTier: 'Kids' })}
                    className={`p-6 rounded-3xl border-2 flex flex-col items-center gap-3 transition-all ${localEditPlayer.pricingTier === 'Kids' ? 'bg-emerald-500 border-emerald-500 text-white shadow-xl shadow-emerald-500/20' : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <Users className={`h-6 w-6 ${localEditPlayer.pricingTier === 'Kids' ? 'text-white' : 'text-slate-200'}`} />
                    <span className="text-xs font-black uppercase tracking-widest">Kids Coaching</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end px-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Session Plans</label>
                  <button onClick={addCustomFrequencyRow} className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest flex items-center gap-1.5 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 transition-all active:scale-95">
                    <Plus className="h-3.5 w-3.5 stroke-[3]" /> Add Row
                  </button>
                </div>
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden divide-y divide-slate-100 shadow-sm">
                  {(() => {
                    const customFreqs = Object.keys(localEditPlayer.customFrequencyRates || {}).map(Number);
                    const defaultFreqs = localEditPlayer.pricingTier === 'Kids' ? [1,2] : [1,2,3,4,5];
                    const allUniqueFreqs = [...new Set([...defaultFreqs, ...customFreqs])].sort((a,b) => a-b);
                    
                    return allUniqueFreqs.map(f => {
                      const isSelected = (localEditPlayer.sessionFrequency || 1) === f;
                      const currentRate = getFreqRate(localEditPlayer, f);
                      return (
                        <div key={f} onClick={() => handleLocalUpdate({ sessionFrequency: f })} className={`p-5 flex items-center justify-between cursor-pointer transition-all ${isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50/50'}`}>
                          <div className="flex items-center gap-5">
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-all shadow-sm ${isSelected ? 'bg-emerald-500 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>{f}S</div>
                            <div>
                              <span className={`text-xs font-black uppercase tracking-widest block ${isSelected ? 'text-emerald-900' : 'text-slate-500'}`}>{f} Session{f > 1 ? 's' : ''} / Wk</span>
                            </div>
                          </div>
                          <div className="relative group" onClick={(e) => e.stopPropagation()}>
                            <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-300" />
                            <input 
                              type="number" 
                              className="w-36 pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl font-black text-sm focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all" 
                              value={currentRate} 
                              onChange={(e) => updateCustomRate(f, parseInt(e.target.value) || 0)} 
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              <div className="bg-slate-900 rounded-[2.5rem] p-10 text-center text-white relative overflow-hidden group shadow-2xl shadow-slate-900/30">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-150"></div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 block relative z-10">Monthly Bill</span>
                <div className="text-6xl font-black flex items-center justify-center gap-2 relative z-10">
                  <IndianRupee className="h-10 w-10 text-emerald-400 opacity-50"/>
                  {calculateFeesForPlayer(localEditPlayer).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 inset-x-0 p-8 bg-white/90 backdrop-blur-xl border-t border-slate-100 flex gap-4 z-20">
              <button onClick={handleSavePlayerConfig} className="flex-1 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95">
                <SaveAll className="h-5 w-5" /> Save Plan
              </button>
              <button onClick={() => handleRecordPayment(localEditPlayer, calculateFeesForPlayer(localEditPlayer), 'Cash')} className="flex-1 py-5 bg-emerald-500 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95">
                <CreditCard className="h-5 w-5" /> Collect Cash
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Coach salary disbursement form modal */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-slate-200">
            <div className="p-10">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-light text-slate-900 tracking-tight">
                    {salaryForm.id ? 'Edit' : 'New'} <span className="font-serif italic text-slate-400">Disbursement</span>
                  </h3>
                  <p className="text-sm text-slate-400 font-bold mt-1 uppercase tracking-widest">Coach Payroll</p>
                </div>
                <button onClick={() => setIsSalaryModalOpen(false)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-all"><X className="h-6 w-6"/></button>
              </div>

              <form onSubmit={handleSaveSalary} className="space-y-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Coach Name</label>
                  <input 
                    required
                    type="text"
                    className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                    placeholder="e.g. Coach Arun"
                    value={salaryForm.coachName || ''}
                    onChange={e => setSalaryForm({...salaryForm, coachName: e.target.value})}
                  />
                </div>

                <div className="bg-slate-900 p-10 rounded-3xl text-center text-white relative overflow-hidden group shadow-xl shadow-slate-900/20">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 transition-transform group-hover:scale-150"></div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] block mb-3 relative z-10">Net Payout</span>
                  <div className="text-4xl font-black flex items-center justify-center gap-2 relative z-10">
                    <IndianRupee className="h-8 w-8 text-emerald-400 opacity-50"/>
                    {salaryForm.amount?.toLocaleString() || 0}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Amount (₹)</label>
                    <input 
                      required
                      type="number"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                      value={salaryForm.amount || ''}
                      onChange={e => setSalaryForm({...salaryForm, amount: parseInt(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Date</label>
                    <input 
                      required
                      type="date"
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm focus:ring-4 focus:ring-emerald-500/5 outline-none transition-all"
                      value={salaryForm.date || ''}
                      onChange={e => setSalaryForm({...salaryForm, date: e.target.value})}
                    />
                  </div>
                </div>

                <button type="submit" className="w-full py-5 bg-emerald-500 text-white rounded-2xl font-black uppercase tracking-[0.2em] shadow-xl shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95">
                  {salaryForm.id ? 'Save Changes' : 'Record Disbursement'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
