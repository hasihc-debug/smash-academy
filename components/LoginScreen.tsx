
import React, { useState } from 'react';
import { Activity, Loader2, Copy, Check, User, ArrowRight, AlertTriangle, ExternalLink } from 'lucide-react';

interface LoginScreenProps {
  onGoogleLogin: () => void;
  onGuestLogin: () => void;
  isLoggingIn: boolean;
  authError?: { title: string, message: string, instruction: string, domain?: string } | null;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onGoogleLogin, onGuestLogin, isLoggingIn, authError }) => {
  const [copied, setCopied] = useState(false);
  const domain = window.location.hostname;

  const handleCopyDomain = () => {
    navigator.clipboard.writeText(authError?.domain || domain);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex bg-slate-900 font-sans">
      
      {/* Left Side - Hero / Brand */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-slate-950 items-center justify-center">
        <div className="absolute inset-0 z-0">
           <img 
             src="https://images.unsplash.com/photo-1626224583764-847890e045b5?q=80&w=2000&auto=format&fit=crop" 
             className="w-full h-full object-cover opacity-30" 
             alt="Badminton Court"
           />
           <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-lg px-12">
            <div className="h-16 w-16 bg-emerald-500 rounded-2xl flex items-center justify-center mb-8 shadow-2xl shadow-emerald-900/50">
                <Activity className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-5xl font-black text-white tracking-tight mb-6 leading-tight">
              Master Your <br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Academy Management</span>
            </h1>
            <p className="text-lg text-slate-400 leading-relaxed mb-8">
              The professional platform for high-performance badminton academies. Track athlete progress, schedule sessions, and analyze performance in one place.
            </p>
            
            <div className="flex items-center gap-4 text-sm font-bold text-slate-500">
               <div className="flex -space-x-2">
                  <div className="h-8 w-8 rounded-full border-2 border-slate-900 bg-slate-800"></div>
                  <div className="h-8 w-8 rounded-full border-2 border-slate-900 bg-slate-700"></div>
                  <div className="h-8 w-8 rounded-full border-2 border-slate-900 bg-slate-600"></div>
               </div>
               <span>Trusted by elite coaches</span>
            </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 bg-white relative">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Welcome back</h2>
            <p className="mt-2 text-slate-500">Please sign in to your dashboard.</p>
          </div>

          {/* Auth Error Troubleshooting Alert */}
          {authError && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5 space-y-3 animate-slide-up">
                  <div className="flex items-start gap-3">
                      <div className="p-2 bg-rose-100 rounded-lg shrink-0">
                          <AlertTriangle className="h-5 w-5 text-rose-600" />
                      </div>
                      <div>
                          <h4 className="text-sm font-black text-rose-900">{authError.title}</h4>
                          <p className="text-xs text-rose-700 mt-0.5 leading-relaxed">{authError.message}</p>
                      </div>
                  </div>
                  
                  <div className="bg-white/60 rounded-xl p-3 text-xs text-rose-800 font-medium">
                      {authError.instruction}
                  </div>

                  {authError.domain && (
                      <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between p-3 bg-white border border-rose-200 rounded-xl">
                              <code className="text-[10px] font-mono font-bold text-rose-900">{authError.domain}</code>
                              <button 
                                  onClick={handleCopyDomain}
                                  className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-600 text-white rounded-lg text-[10px] font-bold hover:bg-rose-700 transition-colors shadow-sm"
                              >
                                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                                  {copied ? 'Copied' : 'Copy'}
                              </button>
                          </div>
                          <a 
                              href="https://console.firebase.google.com/" 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] font-black text-rose-600 hover:text-rose-800 flex items-center gap-1 transition-colors px-1"
                          >
                              Open Firebase Console <ExternalLink className="h-3 w-3" />
                          </a>
                      </div>
                  )}
              </div>
          )}

          <div className="space-y-4">
            <button 
              onClick={onGoogleLogin}
              disabled={isLoggingIn}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl border-2 border-slate-100 hover:border-slate-200 bg-white text-slate-700 font-bold transition-all hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:shadow-none group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingIn ? <Loader2 className="h-5 w-5 animate-spin text-slate-400"/> : (
                <>
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  <span>Sign in with Google</span>
                  <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-slate-400"/>
                </>
              )}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-100"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-widest">
                <span className="px-4 bg-white text-slate-400 font-bold">Or Demo Access</span>
              </div>
            </div>

            <button 
              onClick={onGuestLogin}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold transition-all"
            >
              <User className="h-5 w-5" />
              <span>Continue as Guest Coach</span>
            </button>
          </div>

          <div className="pt-8 mt-8 border-t border-slate-100 text-center">
             <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Development Helper</p>
             <button 
               onClick={() => { navigator.clipboard.writeText(domain); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
               className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-[10px] text-slate-500 font-mono transition-colors border border-slate-200"
             >
               {domain}
               {copied ? <Check className="h-2.5 w-2.5 text-emerald-500"/> : <Copy className="h-2.5 w-2.5"/>}
             </button>
          </div>
        </div>
      </div>
    </div>
  );
};
