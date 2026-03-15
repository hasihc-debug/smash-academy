import React, { useState } from 'react';
import { Check, X, Star, Zap, Shield, Loader2 } from 'lucide-react';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => Promise<void>;
}

export const PricingModal: React.FC<PricingModalProps> = ({ isOpen, onClose, onUpgrade }) => {
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleUpgradeClick = async () => {
      setIsProcessing(true);
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      await onUpgrade();
      setIsProcessing(false);
      onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl relative flex flex-col md:flex-row overflow-hidden animate-scale-in">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-slate-100 hover:bg-slate-200 rounded-full z-20 transition-colors"
        >
            <X className="h-5 w-5 text-slate-500" />
        </button>

        {/* Free Tier */}
        <div className="flex-1 p-8 md:p-10 flex flex-col border-b md:border-b-0 md:border-r border-slate-100">
            <div className="mb-6">
                <h3 className="text-2xl font-bold text-slate-900">Starter</h3>
                <div className="text-4xl font-black text-slate-900 mt-4">$0 <span className="text-lg font-medium text-slate-400">/mo</span></div>
                <p className="text-slate-500 mt-2 text-sm">Perfect for individual coaches just starting out.</p>
            </div>
            <ul className="space-y-4 mb-8 flex-1">
                <li className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <Check className="h-5 w-5 text-emerald-500 shrink-0" /> Max 3 Athletes
                </li>
                <li className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <Check className="h-5 w-5 text-emerald-500 shrink-0" /> Basic Attendance
                </li>
                <li className="flex items-center gap-3 text-sm font-medium text-slate-700">
                    <Check className="h-5 w-5 text-emerald-500 shrink-0" /> Weekly Schedule
                </li>
                <li className="flex items-center gap-3 text-sm font-medium text-slate-400">
                    <X className="h-5 w-5 shrink-0" /> Annual Plan (YTP)
                </li>
                <li className="flex items-center gap-3 text-sm font-medium text-slate-400">
                    <X className="h-5 w-5 shrink-0" /> AI Training Plans
                </li>
            </ul>
            <button onClick={onClose} className="w-full py-3 rounded-xl border border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors">
                Current Plan
            </button>
        </div>

        {/* Pro Tier */}
        <div className="flex-1 p-8 md:p-10 flex flex-col bg-slate-50 relative overflow-hidden">
            <div className="absolute top-0 right-0 bg-gradient-to-l from-amber-400 to-orange-400 text-white text-[10px] font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider shadow-sm z-10">
                Most Popular
            </div>
            <div className="mb-6 relative z-10">
                <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-slate-900">Pro Academy</h3>
                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                </div>
                <div className="text-4xl font-black text-slate-900 mt-4">$29 <span className="text-lg font-medium text-slate-400">/mo</span></div>
                <p className="text-slate-500 mt-2 text-sm">For serious academies scaling their operations.</p>
            </div>
            <ul className="space-y-4 mb-8 flex-1 relative z-10">
                <li className="flex items-center gap-3 text-sm font-bold text-slate-800">
                    <div className="p-1 bg-emerald-100 rounded-full"><Check className="h-3 w-3 text-emerald-600" /></div>
                    Unlimited Athletes
                </li>
                <li className="flex items-center gap-3 text-sm font-bold text-slate-800">
                    <div className="p-1 bg-emerald-100 rounded-full"><Zap className="h-3 w-3 text-emerald-600" /></div>
                    AI Generated Plans (Gemini)
                </li>
                <li className="flex items-center gap-3 text-sm font-bold text-slate-800">
                    <div className="p-1 bg-emerald-100 rounded-full"><Check className="h-3 w-3 text-emerald-600" /></div>
                    Full Annual Plan (YTP)
                </li>
                <li className="flex items-center gap-3 text-sm font-bold text-slate-800">
                    <div className="p-1 bg-emerald-100 rounded-full"><Shield className="h-3 w-3 text-emerald-600" /></div>
                    Custom Academy Branding
                </li>
                <li className="flex items-center gap-3 text-sm font-bold text-slate-800">
                    <div className="p-1 bg-emerald-100 rounded-full"><Check className="h-3 w-3 text-emerald-600" /></div>
                    Advanced Analytics
                </li>
            </ul>
            <button 
                onClick={handleUpgradeClick}
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-all active:scale-[0.98] relative z-10 flex items-center justify-center gap-2"
            >
                {isProcessing ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Processing...
                    </>
                ) : (
                    "Upgrade to Pro"
                )}
            </button>
            
            {/* Background Decor */}
            <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-amber-200 rounded-full blur-3xl opacity-30"></div>
            <div className="absolute top-10 -left-10 w-40 h-40 bg-emerald-200 rounded-full blur-3xl opacity-30"></div>
        </div>
      </div>
    </div>
  );
};