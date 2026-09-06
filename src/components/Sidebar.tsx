import React from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Users,
  MonitorPlay,
  Award,
  HardDrive,
  Key,
  BrainCircuit,
} from 'lucide-react';
import { SchoolProfile, Exam, AppsScriptSettings } from '../types';

interface SidebarProps {
  activeTab: 'dashboard' | 'questions' | 'students' | 'monitoring' | 'results';
  setActiveTab: (tab: 'dashboard' | 'questions' | 'students' | 'monitoring' | 'results') => void;
  schoolProfile: SchoolProfile;
  activeExam: Exam;
  hasGeminiKey: boolean;
  onOpenGeminiModal: () => void;
  onOpenGoogleModal: () => void;
  googleSettings: AppsScriptSettings;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  schoolProfile,
  activeExam,
  hasGeminiKey,
  onOpenGeminiModal,
  onOpenGoogleModal,
  googleSettings,
}) => {
  const navItems: Array<{
    id: 'dashboard' | 'questions' | 'students' | 'monitoring' | 'results';
    label: string;
    sublabel?: string;
    icon: React.ElementType;
  }> = [
    {
      id: 'dashboard',
      label: 'Bento Dashboard',
      sublabel: 'Overview & Integrasi',
      icon: LayoutDashboard,
    },
    {
      id: 'questions',
      label: 'AI Question Bank',
      sublabel: `${activeExam.questions.length} Soal Aktif`,
      icon: FileSpreadsheet,
    },
    {
      id: 'monitoring',
      label: 'Live Monitoring',
      sublabel: 'Anti-Curang Realtime',
      icon: MonitorPlay,
    },
    {
      id: 'students',
      label: 'Student Management',
      sublabel: schoolProfile.name.substring(0, 18),
      icon: Users,
    },
    {
      id: 'results',
      label: 'Exam Results & AI',
      sublabel: 'Remidi & Pengayaan',
      icon: Award,
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col shrink-0 border-r border-slate-800 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-xs">
            <BrainCircuit className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white flex items-center gap-1">
              EduCBT <span className="text-blue-400">AI</span>
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
              Exam Pro Suite
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3.5 space-y-1.5 overflow-y-auto">
        <div className="px-2 py-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Main Navigation
        </div>

        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between text-left transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-medium shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                {isActive ? (
                  <div className="w-2 h-2 bg-white rounded-full shrink-0 shadow-xs" />
                ) : (
                  <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                )}
                <div className="truncate">
                  <span className="text-xs font-semibold block truncate leading-tight">
                    {item.label}
                  </span>
                  {item.sublabel && (
                    <span className="text-[10px] text-slate-400 block truncate leading-tight">
                      {item.sublabel}
                    </span>
                  )}
                </div>
              </div>

              {isActive && (
                <span className="text-[9px] bg-blue-500/80 px-1.5 py-0.5 rounded text-white font-mono font-bold">
                  AKTIF
                </span>
              )}
            </button>
          );
        })}

        {/* Quick Bento Shortcuts */}
        <div className="pt-4 px-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          Archive &amp; Backups
        </div>

        {/* Gemini API Key item */}
        <button
          onClick={onOpenGeminiModal}
          className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-800 text-slate-300 flex items-center justify-between transition group"
        >
          <div className="flex items-center gap-2.5 text-xs">
            <Key className="w-4 h-4 text-indigo-400 group-hover:text-indigo-300" />
            <span>Kunci Gemini API</span>
          </div>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
              hasGeminiKey ? 'bg-indigo-950 text-indigo-300 border border-indigo-700' : 'bg-slate-800 text-slate-400'
            }`}
          >
            {hasGeminiKey ? '••••8X92' : 'ATUR'}
          </span>
        </button>

        {/* Google Drive / GAS item */}
        <button
          onClick={onOpenGoogleModal}
          className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-800 text-slate-300 flex items-center justify-between transition group"
        >
          <div className="flex items-center gap-2.5 text-xs">
            <HardDrive className="w-4 h-4 text-emerald-400 group-hover:text-emerald-300" />
            <span>Google Drive Sync</span>
          </div>
          <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
            {googleSettings.webAppUrl ? 'CONNECTED' : 'STANDBY'}
          </span>
        </button>
      </nav>

      {/* Sidebar Footer Bento Box (Drive Sync Status) */}
      <div className="p-4 border-t border-slate-800 space-y-2">
        <button
          onClick={onOpenGoogleModal}
          className="w-full bg-slate-800 hover:bg-slate-750 p-3 rounded-xl flex items-center justify-between border border-slate-700/60 transition text-left"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />
            <div>
              <span className="text-xs font-semibold text-slate-200 block">G-Drive Sync</span>
              <span className="text-[10px] text-slate-400 block truncate max-w-[110px]">
                /Ujian-CBT-Backup
              </span>
            </div>
          </div>
          <span className="text-[9px] font-bold bg-slate-700 text-emerald-300 px-1.5 py-0.5 rounded tracking-wide">
            CONNECTED
          </span>
        </button>

        <div className="px-1 text-[10px] text-slate-500 flex items-center justify-between font-mono">
          <span>Token: {activeExam.token}</span>
          <span>KKM: {schoolProfile.defaultKkm}</span>
        </div>
      </div>
    </aside>
  );
};
