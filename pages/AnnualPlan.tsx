import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Info, ChevronDown, ChevronUp, ZoomIn, ZoomOut } from 'lucide-react';
import { appId } from '../utils/firebase';
import { dbService } from '../utils/db';
import { User as FirebaseUser, Player } from '../types';

interface AnnualPlanProps {
  user: FirebaseUser;
  setActiveTab: (tab: string) => void;
  setCurrentWeekStart: (date: Date) => void;
}

const PlanRow = ({ title, options, field, yearsView, weeksArray, multiYearData, updateWeek, rowClass, zoomLevel }: any) => {
  const colWidth = 
    zoomLevel === 5 ? 120 : 
    zoomLevel === 4 ? 80 : 
    zoomLevel === 3 ? 60 : 
    zoomLevel === 2 ? 40 : 20;
  const cellStyle = { width: `${colWidth}px`, minWidth: `${colWidth}px` };

  return (
    <tr className="group">
      <td className="sticky left-0 z-20 bg-slate-50 border-r border-b border-slate-100 p-4 text-[10px] font-black text-slate-900 uppercase tracking-widest shadow-[4px_0_8px_-2px_rgba(0,0,0,0.02)] text-left">
        {title}
      </td>
      {yearsView.map((year: number) => (
        weeksArray.map((w: number) => {
          const currentVal = multiYearData[year]?.[w]?.[field] || '';
          const option = options.find((o: any) => o.value === currentVal);
          return (
            <td key={`${year}-${w}`} style={cellStyle} className={`border-r border-b border-slate-100 p-0 ${rowClass} relative group transition-all ${option?.color || 'bg-white'}`}>
              <select 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                value={currentVal} 
                onChange={(e) => updateWeek(year, w, field, e.target.value)}
              >
                {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
              <div className="flex items-center justify-center h-full text-[9px] font-black uppercase leading-none text-center select-none pointer-events-none tracking-tighter overflow-hidden px-1">
                {option?.label !== '-' ? option?.label : ''}
              </div>
            </td>
          );
        })
      ))}
    </tr>
  );
};

const LegendSection = ({ title, options }: any) => (
  <div>
    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4">{title}</h4>
    <div className="space-y-3">
      {options.filter((o: any) => o.value).map((o: any) => (
        <div key={o.value} className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-md shadow-sm ${o.color}`}></div>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-slate-900 leading-none mb-0.5">{o.label}</span>
            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{o.value}</span>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export const AnnualPlan: React.FC<AnnualPlanProps> = ({ user, setActiveTab, setCurrentWeekStart }) => {
  const [startYear, setStartYear] = useState(new Date().getFullYear());
  const [multiYearData, setMultiYearData] = useState<Record<number, any>>({});
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>("");
  const [isLegendOpen, setIsLegendOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(4); // 1: 25%, 2: 50%, 3: 75%, 4: 100%, 5: 150%
  
  const zoomLabels: Record<number, string> = {
    1: '25%',
    2: '50%',
    3: '75%',
    4: '100%',
    5: '150%'
  };
  
  const weeksArray = Array.from({ length: 52 }, (_, i) => i + 1);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const yearsView = React.useMemo(() => [startYear, startYear + 1], [startYear]);

  // --- Configuration Options ---
  const LONG_TERM_OPTIONS = [
    { label: '-', value: '', color: 'bg-white' },
    { label: 'LT1', value: 'LT1', color: 'bg-blue-600 text-white shadow-sm border-blue-700' },
    { label: 'LT2', value: 'LT2', color: 'bg-purple-600 text-white shadow-sm border-purple-700' },
    { label: 'LT3', value: 'LT3', color: 'bg-orange-500 text-white shadow-sm border-orange-600' },
    { label: 'Tran', value: 'Transition', color: 'bg-emerald-500 text-white shadow-sm border-emerald-600' },
  ];

  const MEDIUM_TERM_OPTIONS = [
    { label: '-', value: '', color: 'bg-white' },
    { label: 'Prep', value: 'Preparation', color: 'bg-indigo-500 text-white shadow-sm border-indigo-600' },
    { label: 'Comp', value: 'Competition', color: 'bg-rose-500 text-white shadow-sm border-rose-600' },
    { label: 'Tran', value: 'Transition', color: 'bg-teal-500 text-white shadow-sm border-teal-600' },
  ];

  const SHORT_TERM_OPTIONS = [
    { label: '-', value: '', color: 'bg-white' },
    { label: 'GP', value: 'General Prep', color: 'bg-sky-500 text-white shadow-sm border-sky-600' },
    { label: 'SP', value: 'Specific Prep', color: 'bg-indigo-500 text-white shadow-sm border-indigo-600' },
    { label: 'CD', value: 'Competition Dev', color: 'bg-amber-500 text-white shadow-sm border-amber-600' },
    { label: 'PC', value: 'Priority Comp', color: 'bg-rose-700 text-white shadow-sm border-rose-800' },
    { label: 'Tr', value: 'Transition', color: 'bg-emerald-400 text-white shadow-sm border-emerald-500' },
  ];

  const EVENT_OPTIONS = [
    { label: '-', value: '', color: 'bg-white' },
    { label: 'Test', value: 'Testing', color: 'bg-purple-600 text-white shadow-sm border-purple-700' },
    { label: 'A', value: 'Priority A', color: 'bg-red-600 text-white shadow-sm border-red-700' },
    { label: 'B', value: 'Priority B', color: 'bg-orange-500 text-white shadow-sm border-orange-600' },
    { label: 'C', value: 'Priority C', color: 'bg-yellow-400 text-slate-900 shadow-sm border-yellow-500' },
  ];

  // Helper to calculate date based on specific year
  const getStartDateForYear = (y: number) => {
      const d = new Date(y, 0, 1); 
      const day = d.getDay(); 
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); 
      return new Date(d.setDate(diff)); 
  };

  const getWeekDate = (year: number, weekNum: number) => { 
      const start = getStartDateForYear(year);
      const d = new Date(start); 
      d.setDate(d.getDate() + (weekNum - 1) * 7); 
      return `${d.getDate()}/${d.getMonth() + 1}`; 
  };

  useEffect(() => {
    if (!user) return;
    const unsub = dbService.subscribePlayers(user, appId, (data) => {
        setPlayers(data.sort((a:Player, b:Player) => a.name.localeCompare(b.name)));
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const unsubscribes: (() => void)[] = [];
    yearsView.forEach(year => {
        const docId = selectedPlayerId ? `${year}_${selectedPlayerId}` : `${year}`;
        const unsub = dbService.subscribeYTP(user, appId, docId, (data) => {
            setMultiYearData(prev => ({ ...prev, [year]: data || {} }));
        });
        unsubscribes.push(unsub);
    });
    return () => { unsubscribes.forEach(fn => fn()); };
  }, [user, startYear, selectedPlayerId, yearsView]);

  const updateWeek = async (year: number, weekNum: number, field: string, value: any) => {
    const currentYearData = multiYearData[year] || {};
    const updatedYearData = { 
        ...currentYearData, 
        [weekNum]: { ...(currentYearData[weekNum] || {}), [field]: value } 
    };
    setMultiYearData(prev => ({ ...prev, [year]: updatedYearData }));
    const docId = selectedPlayerId ? `${year}_${selectedPlayerId}` : `${year}`;
    try { await dbService.saveYTP(user, appId, docId, updatedYearData); } catch (e) { console.error(e); }
  };
  
  const handleWeekClick = (year: number, weekNum: number) => {
    const start = getStartDateForYear(year);
    const d = new Date(start);
    d.setDate(d.getDate() + (weekNum - 1) * 7);
    d.setHours(0, 0, 0, 0);
    setCurrentWeekStart(d);
    setActiveTab('weekly');
  };

  const getWeekNumber = (d: Date) => {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
  };

  return (
    <div className="p-6 lg:p-12 flex flex-col h-full max-w-full overflow-hidden bg-[#F8FAFC]">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10">
        <div>
          <h1 className="text-4xl font-light text-slate-900 tracking-tight mb-1">
            Annual <span className="font-serif italic text-slate-400">Periodization</span>
          </h1>
          <p className="text-slate-500 text-sm font-medium">Strategic long-term development and load management.</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setZoomLevel(prev => Math.max(1, prev - 1))}
              disabled={zoomLevel === 1}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Zoom Out"
            >
              <ZoomOut className="h-5 w-5"/>
            </button>
            <div className="px-4 py-1.5 text-center min-w-[80px]">
              <span className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-0.5">Zoom</span>
              <span className="block font-bold text-slate-900 text-sm">{zoomLabels[zoomLevel]}</span>
            </div>
            <button 
              onClick={() => setZoomLevel(prev => Math.min(5, prev + 1))}
              disabled={zoomLevel === 5}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Zoom In"
            >
              <ZoomIn className="h-5 w-5"/>
            </button>
          </div>

          {/* Player Selection */}
          <div className="flex items-center gap-2 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="pl-3 text-[10px] uppercase tracking-widest font-black text-slate-400">Athlete</span>
            <select 
              className="bg-slate-50 border-none text-sm font-bold text-slate-900 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer min-w-[160px]"
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
            >
              <option value="">Academy Global</option>
              {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* Year Navigation */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
            <button 
              onClick={() => setStartYear(prev => prev - 1)}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
            >
              <ChevronLeft className="h-5 w-5"/>
            </button>
            <div className="px-6 py-1.5 text-center min-w-[140px]">
              <span className="block text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-0.5">Cycle Start</span>
              <span className="block font-bold text-slate-900 text-sm">{startYear}</span>
            </div>
            <button 
              onClick={() => setStartYear(prev => prev + 1)}
              className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900 transition-all"
            >
              <ChevronRight className="h-5 w-5"/>
            </button>
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-200/40 overflow-hidden">
        <div className="overflow-auto custom-scrollbar flex-1 relative">
          <table className="w-max text-sm text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-30">
              {/* Year Headers */}
              <tr className="bg-slate-900 text-white">
                <th className="w-48 min-w-[192px] sticky left-0 z-40 bg-slate-900 border-r border-slate-800 p-4">
                   <span className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500">Timeline</span>
                </th>
                {yearsView.map(year => (
                  <th key={year} colSpan={52} className="text-center py-3 border-r border-slate-800 last:border-r-0">
                    <span className="text-xs font-black uppercase tracking-[0.5em]">{year}</span>
                  </th>
                ))}
              </tr>
              
              {/* Month Headers */}
              <tr className="bg-slate-100/80 backdrop-blur-md">
                <th className="sticky left-0 z-40 bg-slate-100/95 backdrop-blur-md border-r border-b border-slate-200 p-4"></th>
                {yearsView.map(year => (
                   months.map((m, idx) => (
                     <th key={`${year}-${m}`} colSpan={idx === 11 ? 4 : 4} className="text-center py-2 border-r border-b border-slate-200 last:border-r-0">
                        <span className="text-[10px] font-black text-slate-400 tracking-widest">{m}</span>
                     </th>
                   ))
                ))}
              </tr>

              {/* Week Headers */}
              <tr className="bg-white">
                <th className="sticky left-0 z-40 bg-white border-r border-b border-slate-200 p-4">
                  <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">Week / Date</span>
                </th>
                {yearsView.map(year => (
                  weeksArray.map(w => {
                    const isCurrentWeek = year === new Date().getFullYear() && w === getWeekNumber(new Date());
                    const colWidth = 
                      zoomLevel === 5 ? 120 : 
                      zoomLevel === 4 ? 80 : 
                      zoomLevel === 3 ? 60 : 
                      zoomLevel === 2 ? 40 : 20;
                    const cellStyle = { width: `${colWidth}px`, minWidth: `${colWidth}px` };
                    return (
                      <th key={`${year}-${w}`} style={cellStyle} className={`text-center py-2 border-r border-b border-slate-100 transition-colors ${isCurrentWeek ? 'bg-indigo-50' : ''}`}>
                        <div className={`text-[10px] font-bold ${isCurrentWeek ? 'text-indigo-600' : 'text-slate-400'}`}>{w}</div>
                        <div className={`text-[9px] font-mono ${isCurrentWeek ? 'text-indigo-400' : 'text-slate-300'}`}>{getWeekDate(year, w)}</div>
                      </th>
                    );
                  })
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {/* Long Term Plan */}
              <PlanRow 
                title="Macrocycle" 
                options={LONG_TERM_OPTIONS} 
                field="longTerm" 
                yearsView={yearsView} 
                weeksArray={weeksArray} 
                multiYearData={multiYearData} 
                updateWeek={updateWeek}
                rowClass="h-14"
                zoomLevel={zoomLevel}
              />

              {/* Medium Term Plan */}
              <PlanRow 
                title="Mesocycle" 
                options={MEDIUM_TERM_OPTIONS} 
                field="mediumTerm" 
                yearsView={yearsView} 
                weeksArray={weeksArray} 
                multiYearData={multiYearData} 
                updateWeek={updateWeek}
                rowClass="h-12"
                zoomLevel={zoomLevel}
              />

              {/* Short Term Plan */}
              <PlanRow 
                title="Microcycle" 
                options={SHORT_TERM_OPTIONS} 
                field="shortTerm" 
                yearsView={yearsView} 
                weeksArray={weeksArray} 
                multiYearData={multiYearData} 
                updateWeek={updateWeek}
                rowClass="h-10"
                zoomLevel={zoomLevel}
              />

              {/* Events */}
              <tr className="group">
                <td className="sticky left-0 z-20 bg-slate-50 border-r border-b border-slate-100 p-4 text-[10px] font-black text-slate-900 uppercase tracking-widest shadow-[4px_0_8px_-2px_rgba(0,0,0,0.02)] text-left">Events</td>
                {yearsView.map(year => (
                  weeksArray.map(w => {
                    const currentVal = multiYearData[year]?.[w]?.events || '';
                    const option = EVENT_OPTIONS.find(o => o.value === currentVal);
                    const colWidth = 
                      zoomLevel === 5 ? 120 : 
                      zoomLevel === 4 ? 80 : 
                      zoomLevel === 3 ? 60 : 
                      zoomLevel === 2 ? 40 : 20;
                    const cellStyle = { width: `${colWidth}px`, minWidth: `${colWidth}px` };
                    return (
                      <td key={`${year}-${w}`} style={cellStyle} className={`border-r border-b border-slate-100 p-0 h-12 relative group transition-all ${option?.color || 'bg-white'}`}>
                        <select 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                          value={currentVal} 
                          onChange={(e) => updateWeek(year, w, 'events', e.target.value)}
                        >
                          {EVENT_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <div className="flex items-center justify-center h-full text-[10px] font-black uppercase leading-none text-center select-none pointer-events-none tracking-tighter overflow-hidden px-1">
                          {option?.label !== '-' ? option?.label : ''}
                        </div>
                      </td>
                    );
                  })
                ))}
              </tr>

              <tr className="group">
                <td className="sticky left-0 z-20 bg-slate-50 border-r border-b border-slate-100 p-4 text-[10px] font-black text-slate-400 uppercase tracking-widest shadow-[4px_0_8px_-2px_rgba(0,0,0,0.02)] border-t-8 border-t-white text-left">Focus</td>
                {yearsView.map(year => (
                  weeksArray.map(w => {
                    const colWidth = 
                      zoomLevel === 5 ? 120 : 
                      zoomLevel === 4 ? 80 : 
                      zoomLevel === 3 ? 60 : 
                      zoomLevel === 2 ? 40 : 20;
                    const cellStyle = { width: `${colWidth}px`, minWidth: `${colWidth}px` };
                    return (
                      <td key={`${year}-${w}`} style={cellStyle} className={`border-r border-b border-slate-100 p-0 h-12 border-t-8 border-t-white relative group`}>
                        <textarea 
                          className="w-full h-full text-[9px] bg-transparent resize-none p-1 focus:bg-slate-50 outline-none text-slate-600 leading-tight text-center font-bold placeholder-slate-200 relative z-10 min-w-0" 
                          value={multiYearData[year]?.[w]?.focus || ''} 
                          onChange={(e) => updateWeek(year, w, 'focus', e.target.value)}
                          onDoubleClick={() => handleWeekClick(year, w)}
                          placeholder="..."
                        />
                      </td>
                    );
                  })
                ))}
              </tr>

              {/* Volume */}
              <tr className="group">
                <td className="sticky left-0 z-20 bg-slate-50 border-r border-b border-slate-100 p-4 text-[10px] font-black text-emerald-600 uppercase tracking-widest shadow-[4px_0_8px_-2px_rgba(0,0,0,0.02)] border-t-4 border-t-slate-50 text-left">Volume</td>
                {yearsView.map(year => (
                  weeksArray.map(w => {
                    const colWidth = 
                      zoomLevel === 5 ? 120 : 
                      zoomLevel === 4 ? 80 : 
                      zoomLevel === 3 ? 60 : 
                      zoomLevel === 2 ? 40 : 20;
                    const cellStyle = { width: `${colWidth}px`, minWidth: `${colWidth}px` };
                    return (
                      <td key={`${year}-${w}`} style={cellStyle} className={`border-r border-b border-slate-100 p-0 h-10 border-t-4 border-t-slate-50`}>
                        <input 
                          type="number" 
                          className="w-full h-full text-center text-[10px] bg-transparent focus:bg-emerald-50 outline-none text-emerald-900 font-black min-w-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" 
                          value={multiYearData[year]?.[w]?.volume || ''} 
                          onChange={(e) => updateWeek(year, w, 'volume', e.target.value)} 
                          placeholder="-"
                        />
                      </td>
                    );
                  })
                ))}
              </tr>

              {/* Intensity */}
              <tr className="group">
                <td className="sticky left-0 z-20 bg-slate-50 border-r border-b border-slate-100 p-4 text-[10px] font-black text-amber-600 uppercase tracking-widest shadow-[4px_0_8px_-2px_rgba(0,0,0,0.02)] text-left">Intensity</td>
                {yearsView.map(year => (
                  weeksArray.map(w => {
                    const colWidth = 
                      zoomLevel === 5 ? 120 : 
                      zoomLevel === 4 ? 80 : 
                      zoomLevel === 3 ? 60 : 
                      zoomLevel === 2 ? 40 : 20;
                    const cellStyle = { width: `${colWidth}px`, minWidth: `${colWidth}px` };
                    return (
                      <td key={`${year}-${w}`} style={cellStyle} className={`border-r border-b border-slate-100 p-0 h-10`}>
                        <select 
                          className="w-full h-full text-center text-[10px] bg-transparent focus:bg-amber-50 outline-none text-amber-900 font-black appearance-none cursor-pointer min-w-0" 
                          value={multiYearData[year]?.[w]?.intensity || ''} 
                          onChange={(e) => updateWeek(year, w, 'intensity', Number(e.target.value))}
                        >
                          <option value=""></option>
                          {[...Array(11).keys()].slice(1).map(n => <option key={n} value={n}>{n}</option>)}
                        </select>
                      </td>
                    );
                  })
                ))}
              </tr>

              {/* Load Graph */}
              <tr className="bg-slate-50/10 group">
                <td className="sticky left-0 z-20 bg-slate-50 border-r border-b border-slate-100 p-4 text-[10px] font-black text-slate-900 uppercase tracking-widest shadow-[4px_0_8px_-2px_rgba(0,0,0,0.02)] text-left">Load</td>
                {yearsView.map(year => (
                  weeksArray.map(w => { 
                    const vol = Number(multiYearData[year]?.[w]?.volume) || 0;
                    const int = Number(multiYearData[year]?.[w]?.intensity) || 0;
                    const load = vol * int; 
                    const maxLoad = 300;
                    const heightPct = Math.min((load / maxLoad) * 100, 100);
                    const colWidth = 
                      zoomLevel === 5 ? 120 : 
                      zoomLevel === 4 ? 80 : 
                      zoomLevel === 3 ? 60 : 
                      zoomLevel === 2 ? 40 : 20;
                    const cellStyle = { width: `${colWidth}px`, minWidth: `${colWidth}px` };

                    return (
                      <td key={`${year}-${w}`} style={cellStyle} className={`border-r border-b border-slate-100 p-0 h-14 relative align-bottom group hover:bg-slate-50 transition-colors`}>
                        <div className="absolute inset-x-0 bottom-0 flex items-end justify-center px-[2px] pb-[2px]">
                          <div 
                            className={`w-full rounded-t-sm transition-all relative shadow-sm ${load > 200 ? 'bg-rose-500/40' : load > 100 ? 'bg-amber-500/40' : 'bg-emerald-500/40'}`} 
                            style={{height:`${heightPct}%`}}
                          ></div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center z-10">
                          <span className="text-[9px] font-black text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity">{load > 0 ? load : ''}</span>
                        </div>
                      </td>
                    )
                  })
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend Footer */}
        <div className="bg-slate-50 border-t border-slate-200">
          <button 
            onClick={() => setIsLegendOpen(!isLegendOpen)}
            className="w-full px-8 py-4 flex items-center justify-between hover:bg-slate-100 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Info className="h-4 w-4 text-slate-400" />
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-500">Periodization Legend</span>
            </div>
            {isLegendOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </button>
          
          {isLegendOpen && (
            <div className="px-8 pb-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <LegendSection title="Macrocycle" options={LONG_TERM_OPTIONS} />
              <LegendSection title="Mesocycle" options={MEDIUM_TERM_OPTIONS} />
              <LegendSection title="Microcycle" options={SHORT_TERM_OPTIONS} />
              <LegendSection title="Events" options={EVENT_OPTIONS} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};