import React, { useState } from 'react';
import {
  MonitorPlay,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  Search,
  Check,
  Edit3,
  Trash2,
  Eye,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  ChevronRight,
  X,
  FileSpreadsheet,
  RefreshCw,
  Share2,
  RotateCcw,
  Copy,
  UserX,
  UserCheck,
} from 'lucide-react';
import { Exam, Student, StudentExamSession } from '../types';

interface LiveMonitoringTabProps {
  exam: Exam;
  students: Student[];
  sessions: StudentExamSession[];
  activePings?: Array<{
    studentId: string;
    studentName: string;
    classRoom: string;
    tabViolations: number;
    lastSeen: number;
  }>;
  onRefreshLive?: () => void;
  isSyncing?: boolean;
  onOpenShareLinkModal?: () => void;
  onUpdateSession: (updated: StudentExamSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onSelectStudentForDetail: (session: StudentExamSession) => void;
}

export interface StudentMonitoringItem {
  id: string; // studentId or sessionId
  studentId: string;
  studentName: string;
  studentNisn: string;
  classRoom: string;
  status: 'sudah_mengerjakan' | 'sedang_mengerjakan' | 'belum_mengerjakan';
  rawSession?: StudentExamSession;
  percentage?: number;
  passedKKM?: boolean;
  tabSwitchCount: number;
  answeredCount: number;
  totalQuestions: number;
  finishTime?: string;
  startTime?: string;
}

export const LiveMonitoringTab: React.FC<LiveMonitoringTabProps> = ({
  exam,
  students,
  sessions,
  activePings = [],
  onRefreshLive,
  isSyncing = false,
  onOpenShareLinkModal,
  onUpdateSession,
  onDeleteSession,
  onSelectStudentForDetail,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingSession, setEditingSession] = useState<StudentExamSession | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);

  // Extract all unique classes from students roster & sessions
  const allClasses = Array.from(
    new Set([
      ...students.map((s) => s.classRoom || exam.grade || 'IX-A'),
      ...sessions.map((s) => s.classRoom || exam.grade || 'IX-A'),
      ...activePings.map((p) => p.classRoom || exam.grade || 'IX-A'),
    ])
  ).sort();

  // Construct comprehensive roster list with status (Sudah, Sedang, Belum)
  const monitoringItems: StudentMonitoringItem[] = [];

  // 1. Process all registered students
  students.forEach((st) => {
    // Check if student has finished session
    const finishedSession = sessions.find(
      (s) => (s.studentId === st.id || s.studentNisn === st.nisn) && s.status === 'selesai'
    );

    if (finishedSession) {
      monitoringItems.push({
        id: finishedSession.id,
        studentId: st.id,
        studentName: st.name,
        studentNisn: st.nisn,
        classRoom: st.classRoom || finishedSession.classRoom || 'IX',
        status: 'sudah_mengerjakan',
        rawSession: finishedSession,
        percentage: finishedSession.percentage,
        passedKKM: finishedSession.passedKKM,
        tabSwitchCount: finishedSession.tabSwitchCount || 0,
        answeredCount: Object.keys(finishedSession.answers || {}).length,
        totalQuestions: exam.questions.length,
        finishTime: finishedSession.finishTime,
        startTime: finishedSession.startTime,
      });
      return;
    }

    // Check if student is actively taking the exam (in progress)
    const activePing = activePings.find((p) => p.studentId === st.id);
    const inProgressSession = sessions.find(
      (s) => (s.studentId === st.id || s.studentNisn === st.nisn) && s.status === 'mengerjakan'
    );

    if (activePing || inProgressSession) {
      const ses = inProgressSession || {
        id: `live-${st.id}`,
        examId: exam.id,
        studentId: st.id,
        studentName: st.name,
        studentNisn: st.nisn,
        classRoom: st.classRoom || 'IX',
        status: (activePing?.tabViolations || 0) > 5 ? 'terindikasi_curang' : 'mengerjakan',
        startTime: new Date().toISOString(),
        tabSwitchCount: activePing?.tabViolations || inProgressSession?.tabSwitchCount || 0,
        cheatLogs: [],
        answers: inProgressSession?.answers || {},
        totalScore: 0,
        maxTotalScore: exam.questions.length * 10,
        percentage: 0,
        passedKKM: false,
      };

      monitoringItems.push({
        id: ses.id,
        studentId: st.id,
        studentName: st.name,
        studentNisn: st.nisn,
        classRoom: st.classRoom || ses.classRoom || 'IX',
        status: 'sedang_mengerjakan',
        rawSession: ses,
        percentage: 0,
        passedKKM: false,
        tabSwitchCount: activePing?.tabViolations ?? inProgressSession?.tabSwitchCount ?? 0,
        answeredCount: Object.keys(ses.answers || {}).length,
        totalQuestions: exam.questions.length,
        startTime: ses.startTime,
      });
      return;
    }

    // Otherwise, student has NOT started yet
    monitoringItems.push({
      id: `unstarted-${st.id}`,
      studentId: st.id,
      studentName: st.name,
      studentNisn: st.nisn,
      classRoom: st.classRoom || 'IX',
      status: 'belum_mengerjakan',
      tabSwitchCount: 0,
      answeredCount: 0,
      totalQuestions: exam.questions.length,
    });
  });

  // 2. Include any sessions from students NOT present in the initial students roster
  sessions.forEach((ses) => {
    if (!monitoringItems.some((m) => m.studentId === ses.studentId || m.id === ses.id)) {
      monitoringItems.push({
        id: ses.id,
        studentId: ses.studentId,
        studentName: ses.studentName,
        studentNisn: ses.studentNisn,
        classRoom: ses.classRoom || 'IX',
        status: ses.status === 'selesai' ? 'sudah_mengerjakan' : 'sedang_mengerjakan',
        rawSession: ses,
        percentage: ses.percentage,
        passedKKM: ses.passedKKM,
        tabSwitchCount: ses.tabSwitchCount || 0,
        answeredCount: Object.keys(ses.answers || {}).length,
        totalQuestions: exam.questions.length,
        finishTime: ses.finishTime,
        startTime: ses.startTime,
      });
    }
  });

  // Filter by Class first
  const classItems = monitoringItems.filter((item) => {
    if (classFilter === 'all') return true;
    return item.classRoom === classFilter;
  });

  // Statistics for selected class
  const classTotal = classItems.length;
  const classSudah = classItems.filter((i) => i.status === 'sudah_mengerjakan').length;
  const classSedang = classItems.filter((i) => i.status === 'sedang_mengerjakan').length;
  const classBelum = classItems.filter((i) => i.status === 'belum_mengerjakan').length;
  const classFlagged = classItems.filter((i) => i.tabSwitchCount > 0).length;
  const classParticipationRate =
    classTotal > 0 ? Math.round(((classSudah + classSedang) / classTotal) * 100) : 0;

  // Filter by Search and Status
  const filteredItems = classItems.filter((item) => {
    const matchesSearch =
      item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.studentNisn.includes(searchTerm) ||
      item.classRoom.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      item.status === statusFilter ||
      (statusFilter === 'curang' && item.tabSwitchCount > 0);

    return matchesSearch && matchesStatus;
  });

  const handleSaveEdit = (updated: StudentExamSession) => {
    onUpdateSession(updated);
    setEditingSession(null);
  };

  const handleCopyStudentLogin = (st: StudentMonitoringItem) => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const studentUrl = `${origin}${pathname}?mode=siswa&token=${exam.token}&nisn=${st.studentNisn}`;
    const text = `Tautan Ujian CBT untuk ${st.studentName} (${st.classRoom}):\n${studentUrl}\nToken Ujian: ${exam.token}`;
    navigator.clipboard.writeText(text);
    setCopyToast(`Tautan ujian untuk ${st.studentName} berhasil disalin!`);
    setTimeout(() => setCopyToast(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {copyToast && (
        <div className="fixed top-5 right-5 z-50 p-3.5 bg-slate-900 text-white rounded-xl shadow-xl flex items-center gap-2 text-xs animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copyToast}</span>
        </div>
      )}

      {/* Top Banner Header */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Monitoring Ujian Terpusat
            </span>
            <span className="text-xs text-slate-500">{exam.subject} • Token: <strong className="font-mono text-indigo-700">{exam.token}</strong></span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Monitoring Nama Siswa Per Kelas &amp; Status Pengerjaan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau seluruh nama siswa per kelas secara real-time dengan keterangan sudah, sedang, atau belum mengerjakan
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenShareLinkModal && (
            <button
              id="btn-share-live-modal"
              onClick={onOpenShareLinkModal}
              className="px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 transition shadow-xs"
            >
              <Share2 className="w-4 h-4" />
              <span>Bagikan Link &amp; Token</span>
            </button>
          )}

          {onRefreshLive && (
            <button
              id="btn-refresh-live"
              onClick={onRefreshLive}
              disabled={isSyncing}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`w-4 h-4 text-emerald-600 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Segarkan'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Class Selector Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setClassFilter('all')}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
            classFilter === 'all'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Semua Kelas ({monitoringItems.length} Siswa)</span>
        </button>

        {allClasses.map((cls) => {
          const countInClass = monitoringItems.filter((m) => m.classRoom === cls).length;
          const sudahInClass = monitoringItems.filter((m) => m.classRoom === cls && m.status === 'sudah_mengerjakan').length;
          return (
            <button
              key={cls}
              onClick={() => setClassFilter(cls)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 ${
                classFilter === cls
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Kelas {cls}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                classFilter === cls ? 'bg-indigo-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}>
                {sudahInClass}/{countInClass} Selesai
              </span>
            </button>
          );
        })}
      </div>

      {/* Stats Grid for Current Selection */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span>Total Siswa</span>
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{classTotal}</p>
          <span className="text-[11px] text-slate-400">{classFilter === 'all' ? 'Seluruh Kelas' : `Kelas ${classFilter}`}</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>Sudah Mengerjakan</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-700 mt-2">{classSudah}</p>
          <span className="text-[11px] text-emerald-600 font-medium">
            {classTotal > 0 ? Math.round((classSudah / classTotal) * 100) : 0}% dari siswa
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/40 shadow-2xs">
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
            <span>Sedang Mengerjakan</span>
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
          </div>
          <p className="text-2xl font-bold text-amber-700 mt-2">{classSedang}</p>
          <span className="text-[11px] text-amber-600 font-medium">Ujian Berlangsung</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 bg-slate-50/60 shadow-2xs">
          <div className="flex items-center justify-between text-slate-600 text-xs font-semibold">
            <span>Belum Mengerjakan</span>
            <UserX className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-600 mt-2">{classBelum}</p>
          <span className="text-[11px] text-slate-500">Menunggu Login Siswa</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/40 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-rose-700 text-xs font-semibold">
            <span>Peringatan Tab</span>
            <ShieldAlert className="w-4 h-4 text-rose-600" />
          </div>
          <p className="text-2xl font-bold text-rose-700 mt-2">{classFlagged}</p>
          <span className="text-[11px] text-rose-600 font-medium">Terindikasi Curang</span>
        </div>
      </div>

      {/* Toolbar & Filters */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Cari berdasarkan nama siswa, NISN, atau kelas..."
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: 'all', label: 'Semua Status' },
            { id: 'sudah_mengerjakan', label: `Sudah Mengerjakan (${classSudah})` },
            { id: 'sedang_mengerjakan', label: `Sedang Mengerjakan (${classSedang})` },
            { id: 'belum_mengerjakan', label: `Belum Mengerjakan (${classBelum})` },
            { id: 'curang', label: `Peringatan Tab (${classFlagged})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition text-xs ${
                statusFilter === f.id
                  ? 'bg-indigo-600 text-white shadow-xs font-semibold'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Comprehensive Student Table with Explicit Keterangan */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 w-12 text-center">No</th>
                <th className="px-4 py-3">Nama Siswa &amp; NISN</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Keterangan Pengerjaan</th>
                <th className="px-4 py-3">Progres Soal</th>
                <th className="px-4 py-3">Disiplin Tab</th>
                <th className="px-4 py-3">Nilai Akhir</th>
                <th className="px-4 py-3 text-right">Tombol Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    Tidak ditemukan data siswa untuk filter saat ini.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => {
                  const progressPct = Math.round(
                    (item.answeredCount / (item.totalQuestions || 1)) * 100
                  );

                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition">
                      <td className="px-4 py-3 text-center font-mono text-slate-400">{idx + 1}</td>

                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 block">{item.studentName}</span>
                        <span className="font-mono text-[11px] text-slate-500">NISN: {item.studentNisn}</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-800">
                          {item.classRoom}
                        </span>
                      </td>

                      {/* Keterangan Status Pengerjaan (Sudah / Sedang / Belum) */}
                      <td className="px-4 py-3">
                        {item.status === 'sudah_mengerjakan' && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                              Sudah Mengerjakan
                            </span>
                            {item.finishTime && (
                              <span className="text-[10px] text-slate-400 block pl-1">
                                Selesai: {new Date(item.finishTime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </div>
                        )}

                        {item.status === 'sedang_mengerjakan' && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                              Sedang Mengerjakan
                            </span>
                            <span className="text-[10px] text-amber-700 block pl-1">
                              Ujian aktif di peramban
                            </span>
                          </div>
                        )}

                        {item.status === 'belum_mengerjakan' && (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                              <UserX className="w-3 h-3 text-slate-400" />
                              Belum Mengerjakan
                            </span>
                            <span className="text-[10px] text-slate-400 block pl-1">
                              Belum memasukkan token
                            </span>
                          </div>
                        )}
                      </td>

                      {/* Progres Soal */}
                      <td className="px-4 py-3">
                        {item.status === 'belum_mengerjakan' ? (
                          <span className="text-slate-400 text-[11px] italic">-</span>
                        ) : (
                          <div className="w-28 space-y-1">
                            <div className="flex justify-between text-[10px] font-semibold">
                              <span>{item.answeredCount}/{item.totalQuestions}</span>
                              <span>{progressPct}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300"
                                style={{ width: `${progressPct}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Peringatan Tab Keluar */}
                      <td className="px-4 py-3">
                        {item.status === 'belum_mengerjakan' ? (
                          <span className="text-slate-400 text-[11px]">-</span>
                        ) : item.tabSwitchCount > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3 h-3 text-rose-600" />
                            {item.tabSwitchCount}x Pindah Tab
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold text-[11px] flex items-center gap-1">
                            <Check className="w-3 h-3 text-emerald-600" /> Tertib (0x)
                          </span>
                        )}
                      </td>

                      {/* Nilai Akhir */}
                      <td className="px-4 py-3">
                        {item.status === 'sudah_mengerjakan' && item.percentage !== undefined ? (
                          <div>
                            <span className="text-sm font-bold text-slate-900 block">
                              {item.percentage.toFixed(1)}
                            </span>
                            <span
                              className={`text-[10px] font-semibold ${
                                item.passedKKM ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {item.passedKKM ? 'TUNTAS' : 'REMIDI'}
                            </span>
                          </div>
                        ) : item.status === 'sedang_mengerjakan' ? (
                          <span className="text-amber-600 italic text-[11px]">Sedang berlangsung</span>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Belum ada nilai</span>
                        )}
                      </td>

                      {/* Tombol Aksi */}
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.rawSession ? (
                            <>
                              {/* 1. Tombol PILIH (Lihat Detail) */}
                              <button
                                id={`btn-select-student-${item.id}`}
                                onClick={() => onSelectStudentForDetail(item.rawSession!)}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition shadow-2xs"
                                title="Lihat rincian lembar jawaban dan asesmen di Menu Hasil Ujian"
                              >
                                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Pilih</span>
                              </button>

                              {/* 2. Tombol EDIT */}
                              <button
                                id={`btn-edit-student-${item.id}`}
                                onClick={() => setEditingSession(item.rawSession!)}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1 transition"
                                title="Edit nilai akhir dan catatan ujian"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                                <span>Edit</span>
                              </button>

                              {/* 3. Tombol RESET UJIAN (Memungkinkan Siswa Mengerjakan Ulang) */}
                              <button
                                id={`btn-reset-student-${item.id}`}
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Reset sesi ujian untuk "${item.studentName}"? Hasil ujian akan dihapus agar siswa dapat login dan mengerjakan ulang dari awal.`
                                    )
                                  ) {
                                    onDeleteSession(item.rawSession!.id);
                                  }
                                }}
                                className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 transition"
                                title="Reset sesi agar siswa dapat mengerjakan ulang ujian jika ada kendala"
                              >
                                <RotateCcw className="w-3.5 h-3.5 text-amber-600" />
                                <span>Reset</span>
                              </button>

                              {/* 4. Tombol HAPUS */}
                              <button
                                id={`btn-delete-student-${item.id}`}
                                onClick={() => {
                                  if (confirm(`Hapus permanen data hasil ujian siswa "${item.studentName}"?`)) {
                                    onDeleteSession(item.rawSession!.id);
                                  }
                                }}
                                className="p-1.5 text-xs font-semibold rounded-lg text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                                title="Hapus sesi pengerjaan siswa"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          ) : (
                            /* Untuk Siswa yang Belum Mengerjakan: Tombol Salin Link & Token */
                            <button
                              onClick={() => handleCopyStudentLogin(item)}
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 flex items-center gap-1 transition"
                              title="Salin tautan ujian langsung dengan token untuk siswa ini"
                            >
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Salin Token Siswa</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Session Modal */}
      {editingSession && (
        <EditSessionModal
          session={editingSession}
          onSave={handleSaveEdit}
          onClose={() => setEditingSession(null)}
        />
      )}
    </div>
  );
};

// Sub-component for editing student session
interface EditSessionModalProps {
  session: StudentExamSession;
  onSave: (ses: StudentExamSession) => void;
  onClose: () => void;
}

const EditSessionModal: React.FC<EditSessionModalProps> = ({ session, onSave, onClose }) => {
  const [totalScore, setTotalScore] = useState(session.totalScore);
  const [maxTotalScore, setMaxTotalScore] = useState(session.maxTotalScore);
  const [status, setStatus] = useState(session.status);
  const [tabSwitchCount, setTabSwitchCount] = useState(session.tabSwitchCount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const pct = maxTotalScore > 0 ? (totalScore / maxTotalScore) * 100 : 0;
    onSave({
      ...session,
      totalScore,
      maxTotalScore,
      percentage: pct,
      passedKKM: pct >= 75,
      status,
      tabSwitchCount,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">Edit Hasil &amp; Sesi Ujian Siswa</h3>
            <p className="text-xs text-slate-300">{session.studentName} ({session.studentNisn})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Status Sesi Ujian</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
            >
              <option value="mengerjakan">Sedang Mengerjakan</option>
              <option value="selesai">Selesai</option>
              <option value="terindikasi_curang">Terindikasi Curang (Diskualifikasi)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Skor Diperoleh</label>
              <input
                type="number"
                min={0}
                value={totalScore}
                onChange={(e) => setTotalScore(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-700"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Skor Maksimal Total</label>
              <input
                type="number"
                min={1}
                value={maxTotalScore}
                onChange={(e) => setMaxTotalScore(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Jumlah Peringatan Tab Keluar</label>
            <input
              type="number"
              min={0}
              value={tabSwitchCount}
              onChange={(e) => setTabSwitchCount(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-slate-600">
            Nilai Akhir Baru: <strong>{maxTotalScore > 0 ? ((totalScore / maxTotalScore) * 100).toFixed(1) : 0} / 100</strong>{' '}
            ({(totalScore / maxTotalScore) * 100 >= 75 ? 'TUNTAS' : 'BELUM TUNTAS / REMIDI'})
          </div>

          <div className="pt-2 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs"
            >
              Simpan Perubahan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
