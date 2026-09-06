import React from 'react';
import {
  BrainCircuit,
  CloudCheck,
  Key,
  MonitorPlay,
  FileSpreadsheet,
  Users,
  HardDrive,
  Award,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import { SchoolProfile, Exam } from '../types';

interface NavbarProps {
  activeTab: 'questions' | 'students' | 'monitoring' | 'results' | 'drive';
  setActiveTab: (tab: 'questions' | 'students' | 'monitoring' | 'results' | 'drive') => void;
  schoolProfile: SchoolProfile;
  activeExam: Exam;
  onOpenGeminiModal: () => void;
  onOpenGasModal: () => void;
  onLaunchStudentMode: (newTab?: boolean) => void;
  hasCustomGeminiKey: boolean;
  isDriveConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  schoolProfile,
  activeExam,
  onOpenGeminiModal,
  onOpenGasModal,
  onLaunchStudentMode,
  hasCustomGeminiKey,
  isDriveConnected,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-xs">
      {/* Top Banner with Institution Info & Quick Integrations */}
      <div className="bg-slate-900 text-slate-100 text-xs px-4 py-1.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            EduCBT AI v2.6 • CBT Interaktif Kurikulum Merdeka
          </span>
          <span className="text-slate-400 hidden sm:inline">|</span>
          <span className="text-slate-300 hidden sm:inline truncate max-w-xs">{schoolProfile.name}</span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {/* Google Apps Script & Drive Status */}
          <button
            id="nav-btn-gas-status"
            onClick={onOpenGasModal}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 hover:text-emerald-200 border border-slate-700 transition"
            title="Kelola Integrasi Google Sheets, Drive & Apps Script"
          >
            <CloudCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-medium">Google Drive & Sheets:</span>
            <span className="text-slate-200 font-semibold">{isDriveConnected ? 'Terhubung' : 'Siap'}</span>
          </button>

          {/* Gemini API Key Button */}
          <button
            id="nav-btn-gemini-key"
            onClick={onOpenGeminiModal}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border transition font-medium ${
              hasCustomGeminiKey
                ? 'bg-indigo-950 text-indigo-300 border-indigo-700 hover:bg-indigo-900'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            <Key className="w-3.5 h-3.5 text-indigo-400" />
            <span>Kunci API Gemini</span>
            {hasCustomGeminiKey && <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>}
          </button>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo & Exam Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shadow-sm shrink-0">
              <BrainCircuit className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-slate-900 text-base sm:text-lg tracking-tight truncate">
                  EduCBT <span className="text-indigo-600 font-extrabold">AI</span>
                </h1>
                <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-semibold px-2 py-0.5 rounded-full hidden md:inline-flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-500" /> AI Scoring & Backup
                </span>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-sm sm:max-w-md">
                Ujian: <span className="font-medium text-slate-700">{activeExam.subject}</span> ({activeExam.grade}) • Token: <span className="font-mono font-bold text-indigo-600">{activeExam.token}</span>
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            <button
              id="tab-btn-questions"
              onClick={() => setActiveTab('questions')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'questions'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Bank Soal & AI</span>
            </button>

            <button
              id="tab-btn-students"
              onClick={() => setActiveTab('students')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'students'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Sekolah & Siswa</span>
            </button>

            <button
              id="tab-btn-monitoring"
              onClick={() => setActiveTab('monitoring')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'monitoring'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <MonitorPlay className="w-4 h-4" />
              <span>Live Monitoring</span>
            </button>

            <button
              id="tab-btn-results"
              onClick={() => setActiveTab('results')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'results'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Hasil & Cetak Nilai</span>
            </button>

            <button
              id="tab-btn-drive"
              onClick={() => setActiveTab('drive')}
              className={`px-3 py-2 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition ${
                activeTab === 'drive'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <HardDrive className="w-4 h-4" />
              <span>Backup GDrive</span>
            </button>
          </nav>

          {/* Student Mode Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              id="btn-launch-student-modal"
              onClick={() => onLaunchStudentMode(false)}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-xs transition"
            >
              <MonitorPlay className="w-4 h-4" />
              <span className="hidden sm:inline">Mulai Mode Siswa</span>
              <span className="sm:hidden">Siswa</span>
            </button>

            <button
              id="btn-launch-student-tab"
              onClick={() => onLaunchStudentMode(true)}
              className="p-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
              title="Buka Mode Siswa di Tab Baru Terisolasi (Sesuai Permintaan)"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Sub-Navigation */}
        <div className="lg:hidden flex items-center gap-1 pb-3 overflow-x-auto no-scrollbar">
          {[
            { id: 'questions', label: 'Soal & AI', icon: FileSpreadsheet },
            { id: 'students', label: 'Siswa & Sekolah', icon: Users },
            { id: 'monitoring', label: 'Live Monitoring', icon: MonitorPlay },
            { id: 'results', label: 'Hasil & Cetak', icon: Award },
            { id: 'drive', label: 'Drive Backup', icon: HardDrive },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg shrink-0 flex items-center gap-1.5 transition ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
