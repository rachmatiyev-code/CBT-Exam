import React from 'react';
import {
  Menu,
  Key,
  MonitorPlay,
  ExternalLink,
  Sparkles,
  CloudCheck,
  ShieldAlert,
} from 'lucide-react';
import { SchoolProfile, Exam } from '../types';

interface HeaderProps {
  schoolProfile: SchoolProfile;
  activeExam: Exam;
  hasGeminiKey: boolean;
  activePingsCount?: number;
  onOpenGeminiModal: () => void;
  onOpenGoogleModal: () => void;
  onLaunchStudentMode: (newTab?: boolean) => void;
  onToggleMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  schoolProfile,
  activeExam,
  hasGeminiKey,
  activePingsCount = 0,
  onOpenGeminiModal,
  onOpenGoogleModal,
  onLaunchStudentMode,
  onToggleMobileSidebar,
}) => {
  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between shrink-0 select-none z-30">
      {/* Left: Mobile hamburger & School Context */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onToggleMobileSidebar}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          aria-label="Toggle navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h2 className="font-bold text-slate-800 text-xs sm:text-sm truncate flex items-center gap-2">
            <span>{schoolProfile.name}</span>
            <span className="text-slate-300 font-normal hidden sm:inline">•</span>
            <span className="text-blue-600 font-semibold hidden sm:inline">
              Kelas {activeExam.grade} ({activeExam.subject})
            </span>
          </h2>
          <p className="text-[11px] text-slate-500 truncate hidden md:block">
            Materi: <span className="font-medium text-slate-700">{activeExam.coreMaterial || activeExam.title}</span> • Token:{' '}
            <span className="font-mono font-bold text-blue-600">{activeExam.token}</span>
          </p>
        </div>
      </div>

      {/* Right: Server status, API pill & Student Mode Launch */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        {/* Real-time Multi-Device Sync Indicator */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs"
          title="Server Terpusat Aktif: Siswa dapat mengerjakan serentak dari HP / Laptop berbeda"
        >
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            Multi-Perangkat: <strong className="font-bold">{activePingsCount > 0 ? `${activePingsCount} Siswa Aktif` : 'Siap Terhubung'}</strong>
          </span>
        </div>
        {/* Gemini API Key Status Pill */}
        <button
          id="header-btn-gemini-pill"
          onClick={onOpenGeminiModal}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 px-3 py-1.5 rounded-full transition shadow-2xs"
          title="Kelola Kunci Gemini AI"
        >
          <Key className="w-3.5 h-3.5 text-blue-600" />
          <span className="hidden sm:inline text-slate-500">Gemini API:</span>
          {hasGeminiKey ? (
            <span className="text-green-600 font-mono font-bold text-[11px]">••••8X92</span>
          ) : (
            <span className="text-amber-600 font-medium text-[11px]">Belum Ada</span>
          )}
        </button>

        {/* Student Mode Button Group */}
        <div className="flex items-center gap-1">
          {/* Main Launch Button (In tab or direct) */}
          <button
            id="header-btn-launch-student"
            onClick={() => onLaunchStudentMode(true)}
            className="bg-red-500 hover:bg-red-600 text-white text-xs px-3 sm:px-4 py-2 rounded-xl font-bold uppercase tracking-tight shadow-sm flex items-center gap-1.5 transition active:scale-95"
            title="Buka Mode Siswa Terisolasi di Tab Baru"
          >
            <MonitorPlay className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Launch Student Mode</span>
            <span className="sm:hidden">Mode Siswa</span>
          </button>

          {/* New Tab Direct Button */}
          <button
            onClick={() => onLaunchStudentMode(false)}
            className="hidden sm:flex p-2 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition"
            title="Buka Langsung di Tab Ini"
          >
            <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
          </button>
        </div>
      </div>
    </header>
  );
};
