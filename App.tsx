
import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithCustomToken, signOut } from 'firebase/auth';
import { Activity, Menu, ShieldCheck } from 'lucide-react';
import { auth, googleProvider, appId, isConfigured } from './utils/firebase';
import { dbService, testConnection } from './utils/db';
import { User, AcademySettings } from './types';
import { getMonday } from './utils/helpers';

// Components
import { LoginScreen } from './components/LoginScreen';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './pages/Dashboard';
import { PlayersManager } from './pages/PlayersManager';
import { AttendanceManager } from './pages/AttendanceManager';
import { AnnualPlan } from './pages/AnnualPlan';
import { WeeklySchedule } from './pages/WeeklySchedule';
import { TournamentsManager } from './pages/TournamentsManager';
import { FinanceManager } from './pages/FinanceManager';
import { PricingModal } from './components/PricingModal';

declare const __initial_auth_token: string | undefined;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(getMonday(new Date()));
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [userRole, setUserRole] = useState<'COACH' | 'PLAYER' | 'PENDING' | 'LOADING'>('LOADING');
  const [authError, setAuthError] = useState<{title: string, message: string, instruction: string, domain?: string} | null>(null);
  const [academySettings, setAcademySettings] = useState<AcademySettings>({ name: 'Smash Academy', logoUrl: '' });

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.removeItem('theme');
    const initAuth = async () => {
      testConnection();
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        setIsLoggingIn(true);
        try { await signInWithCustomToken(auth, __initial_auth_token); } catch { console.error("Token sign in failed"); }
        setIsLoggingIn(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser) {
            const u = { uid: firebaseUser.uid, email: firebaseUser.email, displayName: firebaseUser.displayName, photoURL: firebaseUser.photoURL, subscriptionStatus: 'free' as const };
            setUser(u); checkRole(u);
            dbService.subscribeAcademySettings(u, appId, (data) => { if(data) setAcademySettings(data); });
        } else {
            setUser(prev => prev?.uid.startsWith('demo-') ? prev : null);
            setUserRole('LOADING');
        }
    });
    return () => unsubscribe();
  }, []);

  const checkRole = async (u: User) => {
      setUserRole('LOADING');
      try {
          const { role, playerId } = await dbService.checkUserRole(u, appId);
          if (role === 'PLAYER' && playerId) { 
              setUser(prev => prev ? { ...prev, role: 'PLAYER', linkedPlayerId: playerId } : null); 
              setUserRole('PLAYER'); 
              setActiveTab('players'); 
          }
          else if (role === 'PENDING') setUserRole('PENDING');
          else { 
              setUserRole('COACH'); 
              setUser(prev => prev ? { ...prev, role: 'COACH', subscriptionStatus: 'free' } : null); 
          }
      } catch { setUserRole('COACH'); }
  };

  const handleCancelRequest = async () => { if(!user) return; await dbService.cancelAccessRequest(user); checkRole(user); };
  
  const handleGoogleLogin = async () => {
    if (!isConfigured) { 
        setAuthError({ 
            title: 'Setup Required', 
            message: 'Firebase configuration is missing.', 
            instruction: 'Please check your environment variables.' 
        }); 
        return; 
    }
    
    setIsLoggingIn(true); 
    setAuthError(null);
    
    try { 
        await signInWithPopup(auth, googleProvider); 
    } catch (error: unknown) { 
        const err = error as { code?: string, message?: string };
        console.error("Sign-In failed:", err);
        
        if (err.code === 'auth/unauthorized-domain') {
            setAuthError({
                title: 'Unauthorized Domain',
                message: 'This domain is not authorized in your Firebase project.',
                instruction: 'Add the domain below to your Firebase Console > Authentication > Settings > Authorized Domains.',
                domain: window.location.hostname
            });
        } else {
            setAuthError({ 
                title: 'Sign In Failed', 
                message: err.message || 'An unexpected error occurred.', 
                instruction: 'Please try again or contact support.' 
            }); 
        }
    } finally { 
        setIsLoggingIn(false); 
    }
  };

  const handleGuestLogin = () => { 
      const u = { uid: 'demo-guest-' + Date.now(), email: 'guest@smashacademy.com', displayName: 'Guest Coach', photoURL: null, role: 'COACH' as const, subscriptionStatus: 'free' as const }; 
      setUser(u); 
      setUserRole('COACH'); 
  };

  const handleLogout = async () => { 
      try { await signOut(auth); } catch { /* Ignore sign out errors */ } 
      setUser(null); 
      setUserRole('LOADING'); 
      setRoleCheckComplete(false); 
      setAuthError(null);
  };

  const handleUpgrade = async () => { if (user) { setUser({ ...user, subscriptionStatus: 'pro' }); } };

  if (!user) return (
    <LoginScreen 
        onGoogleLogin={handleGoogleLogin} 
        onGuestLogin={handleGuestLogin} 
        isLoggingIn={isLoggingIn} 
        authError={authError}
    />
  );
  
  if (userRole === 'PENDING') return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl p-8 text-center border border-slate-100">
            <div className="h-20 w-20 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6"><ShieldCheck className="h-10 w-10 text-amber-500" /></div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Request Pending</h2>
            <div className="flex flex-col gap-3 mt-8">
                <button onClick={handleCancelRequest} className="w-full px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-sm">Cancel Request</button>
                <button onClick={handleLogout} className="w-full px-6 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl transition-colors">Sign Out</button>
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden selection:bg-emerald-100 selection:text-emerald-900">
      <PricingModal isOpen={isPricingOpen} onClose={() => setIsPricingOpen(false)} onUpgrade={handleUpgrade} />
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        mobileMenuOpen={mobileMenuOpen} 
        setMobileMenuOpen={setMobileMenuOpen} 
        user={user} 
        userRole={userRole}
        onLogout={handleLogout} 
        onUpgradeClick={() => setIsPricingOpen(true)}
        academySettings={academySettings}
      />
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <header className="lg:hidden bg-white border-b border-slate-100 h-16 flex items-center px-6 justify-between z-30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">SMASHPRO</span>
          </div>
          <button onClick={() => setMobileMenuOpen(true)} className="text-slate-500 p-2 hover:bg-slate-50 rounded-xl transition-colors">
            <Menu className="h-6 w-6" />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden relative scroll-smooth bg-slate-50/50 custom-scrollbar">
           <div className="min-h-full">
             {activeTab === 'dashboard' && <Dashboard user={user} userRole={userRole} setActiveTab={setActiveTab} academySettings={academySettings} />}
             {activeTab === 'players' && <PlayersManager user={user} />}
             {userRole !== 'PLAYER' && (
                 <>
                     {activeTab === 'attendance' && <AttendanceManager user={user} />}
                     {activeTab === 'annual' && <AnnualPlan user={user} setActiveTab={setActiveTab} setCurrentWeekStart={setCurrentWeekStart} />}
                     {activeTab === 'weekly' && <WeeklySchedule user={user} currentWeekStart={currentWeekStart} setCurrentWeekStart={setCurrentWeekStart} />}
                     {activeTab === 'tournaments' && <TournamentsManager user={user} />}
                     {activeTab === 'finance' && <FinanceManager user={user} setActiveTab={setActiveTab} />}
                 </>
             )}
           </div>
        </main>
      </div>
    </div>
  );
}
