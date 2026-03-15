
import React from 'react';
import { 
  Users, 
  Calendar, 
  ClipboardList, 
  Activity, 
  LayoutDashboard,
  LogOut,
  X,
  Trophy,
  Zap,
  Star,
  Wallet
} from 'lucide-react';
import { User, AcademySettings } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  user: User | null;
  userRole: string;
  onLogout: () => void;
  onUpgradeClick: () => void;
  academySettings?: AcademySettings;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  mobileMenuOpen, 
  setMobileMenuOpen, 
  user, 
  userRole,
  onLogout, 
  onUpgradeClick,
  academySettings 
}) => {
  const isPlayer = userRole === 'PLAYER';
  const isPro = user?.subscriptionStatus === 'pro';
  
  const menuItems = isPlayer 
    ? [
        { id: 'players', label: 'My Profile', icon: Users },
      ]
    : [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }, 
        { id: 'players', label: 'Athletes', icon: Users }, 
        { id: 'attendance', label: 'Attendance', icon: ClipboardList },
        { id: 'weekly', label: 'Schedule', icon: Activity },
        { id: 'annual', label: 'Annual Plan', icon: Calendar }, 
        { id: 'tournaments', label: 'Tournaments', icon: Trophy }, 
        { id: 'finance', label: 'Finance', icon: Wallet },
      ];

  return (
    <>
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}
      
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-950 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col border-r border-white/5 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        <div className="flex items-center justify-between h-20 px-6 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 overflow-hidden">
              {academySettings?.logoUrl ? (
                <img src={academySettings.logoUrl} alt="Logo" className="h-full w-full object-cover" />
              ) : (
                <Activity className="h-5 w-5 text-white" />
              )}
            </div>
            <div className="min-w-0">
              <h1 className="font-bold text-sm tracking-tight text-white leading-none truncate">
                {academySettings?.name ? academySettings.name : 'Smash Academy'}
              </h1>
              <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mt-1">Management</p>
            </div>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden text-slate-500 hover:text-white transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-3 py-4 flex-1 overflow-y-auto dark-scrollbar space-y-1">
          <div className="px-4 mb-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">Main</div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setActiveTab(item.id); setMobileMenuOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'bg-white/5 text-white' 
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {isActive && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-emerald-500 rounded-r-full shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>}
                <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-400'}`} />
                <span className="font-medium text-sm tracking-wide">{item.label}</span>
              </button>
            );
          })}
        </div>

        {!isPlayer && (
          <div className="px-4 mb-4">
            {isPro ? (
               <div className="bg-slate-900/50 rounded-xl p-3 border border-white/5 relative overflow-hidden group">
                  <div className="flex items-center gap-2 mb-1">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400"/>
                      <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Pro Plan</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">Full access enabled.</p>
               </div>
            ) : (
               <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20 relative overflow-hidden">
                  <div className="flex items-center gap-2 mb-2">
                    <Zap className="h-4 w-4 text-emerald-400" />
                    <h3 className="font-bold text-emerald-400 text-xs">Go Pro</h3>
                  </div>
                  <p className="text-[10px] text-emerald-400/60 mb-3 leading-tight">Unlock AI features & financial reports.</p>
                  <button onClick={onUpgradeClick} className="w-full py-1.5 bg-emerald-500 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-400 transition-colors">Upgrade Now</button>
               </div>
            )}
          </div>
        )}

        <div className="p-4 border-t border-white/5">
           <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
              <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-emerald-400 font-bold border border-white/5 relative shrink-0">
                 {user?.photoURL ? <img src={user.photoURL} alt="User" className="h-full w-full object-cover rounded-full" /> : user?.email?.charAt(0).toUpperCase() || 'U'}
                 <div className="absolute bottom-0 right-0 h-2 w-2 bg-emerald-500 border-2 border-slate-950 rounded-full"></div>
              </div>
              <div className="flex-1 min-w-0">
                 <div className="text-xs font-bold text-white truncate leading-tight">{user?.displayName || 'User'}</div>
                 <div className="text-[9px] text-slate-500 font-medium truncate uppercase tracking-tighter">{isPlayer ? 'Athlete' : 'Coach'}</div>
              </div>
              <button onClick={onLogout} className="p-1.5 text-slate-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100" title="Sign Out"><LogOut className="h-3.5 w-3.5" /></button>
           </div>
        </div>
      </div>
    </>
  );
};
