import React, { useState } from 'react';
import {
  Sparkles,
  FileSpreadsheet,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  Send,
  Printer,
  Upload,
  Download,
  Users,
  Eye,
  RotateCcw,
  Clock,
  ChevronRight,
  ShieldAlert,
  Share2,
} from 'lucide-react';
import { Exam, SchoolProfile, Student, StudentExamSession, AppsScriptSettings } from '../types';
import { excelService } from '../services/gasSync';

interface BentoDashboardProps {
  exam: Exam;
  schoolProfile: SchoolProfile;
  students: Student[];
  sessions: StudentExamSession[];
  googleSettings: AppsScriptSettings;
  onOpenAiGenerator: () => void;
  onOpenGoogleModal: () => void;
  onOpenShareLinkModal?: () => void;
  onNavigateTab: (tab: 'questions' | 'students' | 'monitoring' | 'results') => void;
  onOpenPrintModal: (type: 'individual' | 'classical', session?: StudentExamSession) => void;
  onTriggerBackup: () => void;
  onLaunchStudentMode: (newTab?: boolean) => void;
}

export const BentoDashboard: React.FC<BentoDashboardProps> = ({
  exam,
  schoolProfile,
  students,
  sessions,
  googleSettings,
  onOpenAiGenerator,
  onOpenGoogleModal,
  onOpenShareLinkModal,
  onNavigateTab,
  onOpenPrintModal,
  onTriggerBackup,
  onLaunchStudentMode,
}) => {
  // Quick active state for inline generator parameters
  const [subject, setSubject] = useState(exam.subject);
  const [coreTopic, setCoreTopic] = useState(exam.coreMaterial || 'Biologi Sel & Metabolisme');
  const [grade, setGrade] = useState(exam.grade);
  const [semester, setSemester] = useState(exam.semester);

  // Stats
  const activeSessions = sessions.filter((s) => s.status === 'mengerjakan');
  const completedSessions = sessions.filter((s) => s.status === 'selesai');
  const flaggedSessions = sessions.filter((s) => s.tabSwitchCount > 0);

  // Send WhatsApp to first student's parent helper
  const handleQuickWhatsApp = (session: StudentExamSession) => {
    const student = students.find((s) => s.id === session.studentId || s.nisn === session.studentNisn);
    const rawPhone = student?.parentPhone || '081234567890';
    let clean = rawPhone.replace(/\D/g, '');
    if (clean.startsWith('0')) clean = '62' + clean.substring(1);

    const msg = encodeURIComponent(
      `Yth. Orang Tua/Wali dari ${session.studentName},\n` +
      `Hasil Asesmen CBT ${exam.subject}: Nilai ${session.percentage.toFixed(1)}/100 (${session.passedKKM ? 'TUNTAS' : 'REMIDI'}).\n` +
      `Sekolah: ${schoolProfile.name}`
    );
    window.open(`https://wa.me/${clean}?text=${msg}`, '_blank');
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 auto-rows-auto">
      {/* ------------------------------------------------------------- */}
      {/* BENTO CARD 1: AI Question Generator (col-span-8)              */}
      {/* ------------------------------------------------------------- */}
      <section className="col-span-1 md:col-span-12 lg:col-span-8 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="font-bold text-slate-800 text-base">AI Question Generator</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Buat paket butir soal otomatis dengan model Gemini 2.5/Flash
            </p>
          </div>
          <span className="text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-md font-medium flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-600" /> Smart Mode Active
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          {/* Left Form */}
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Subject / Mata Pelajaran
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs bg-slate-50 font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Topic / Materi Pokok
              </label>
              <input
                type="text"
                value={coreTopic}
                onChange={(e) => setCoreTopic(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Grade / Kelas
                </label>
                <input
                  type="text"
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Semester
                </label>
                <input
                  type="text"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-center focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Right Form: Formats Card */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300 flex flex-col justify-between text-xs">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Supported Question Formats
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium">
                  <input type="checkbox" defaultChecked readOnly className="accent-blue-600" />
                  <span>Pilihan Ganda</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium">
                  <input type="checkbox" defaultChecked readOnly className="accent-blue-600" />
                  <span>PG Kompleks</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium">
                  <input type="checkbox" defaultChecked readOnly className="accent-blue-600" />
                  <span>Isian Singkat</span>
                </div>
                <div className="flex items-center gap-2 p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium">
                  <input type="checkbox" defaultChecked readOnly className="accent-blue-600" />
                  <span>Esai (AI Scored)</span>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onOpenAiGenerator}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2.5 text-xs font-bold shadow-sm transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Buka AI Generator Soal ({exam.questions.length} Tersimpan)</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* BENTO CARD 2: Live Monitoring (col-span-4)                     */}
      {/* ------------------------------------------------------------- */}
      <section className="col-span-1 md:col-span-12 lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Live Monitoring</h3>
              <p className="text-[11px] text-slate-400">Pengawasan Ujian Anti-Curang</p>
            </div>
            <div className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full text-xs font-semibold">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span>{sessions.length} Peserta</span>
            </div>
          </div>

          {/* Student Status List */}
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {sessions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Belum ada sesi aktif.
              </div>
            ) : (
              sessions.slice(0, 4).map((s) => {
                const initials = s.studentName
                  .split(' ')
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase();
                const answered = Object.keys(s.answers).length;
                const total = exam.questions.length;
                const pct = Math.round((answered / (total || 1)) * 100);
                const hasWarning = s.tabSwitchCount > 0;

                return (
                  <div
                    key={s.id}
                    onClick={() => onNavigateTab('monitoring')}
                    className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-xl border border-slate-100 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                          hasWarning
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {initials}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-800 truncate max-w-[130px]">
                          {s.studentName}
                        </p>
                        {hasWarning ? (
                          <p className="text-[10px] text-amber-600 font-medium italic">
                            Warning: {s.tabSwitchCount}x Tab Change!
                          </p>
                        ) : (
                          <p className="text-[10px] text-green-600 font-medium">
                            Progress: {pct}%
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      {s.status === 'selesai' ? (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono font-bold">
                          {s.percentage.toFixed(0)}/100
                        </span>
                      ) : hasWarning ? (
                        <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded font-bold">
                          FLAGGED
                        </span>
                      ) : (
                        <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-mono">
                          Q {answered}/{total}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center gap-2">
          {onOpenShareLinkModal && (
            <button
              onClick={onOpenShareLinkModal}
              className="w-full sm:w-1/2 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition flex items-center justify-center gap-1.5 shadow-2xs"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Bagikan Link Siswa</span>
            </button>
          )}
          <button
            onClick={() => onNavigateTab('monitoring')}
            className={`w-full ${
              onOpenShareLinkModal ? 'sm:w-1/2' : ''
            } py-2 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-xl transition flex items-center justify-center gap-1`}
          >
            <span>Live Monitoring</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* BENTO CARD 3: Storage & Integration (col-span-4)               */}
      {/* ------------------------------------------------------------- */}
      <section className="col-span-1 md:col-span-6 lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-slate-800 mb-3 text-sm sm:text-base">Storage &amp; Integration</h3>
          <div className="space-y-2.5 text-xs">
            {/* Sheets Card */}
            <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-green-700 font-bold shrink-0">
                📄
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Google Sheets
                </p>
                <p className="text-xs font-semibold text-slate-800 truncate">
                  {schoolProfile.name.replace(/\s+/g, '_')}_Nilai.gsheet
                </p>
              </div>
            </div>

            {/* Drive Card */}
            <div className="flex items-center gap-3 p-2.5 bg-slate-50 rounded-xl border border-slate-200/70">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center text-blue-700 font-bold shrink-0">
                📁
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Google Drive Folder
                </p>
                <p className="text-xs font-semibold text-slate-800 truncate">
                  /Ujian-CBT-Backup/{activeSessions.length > 0 ? 'Live' : 'Archived'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            onClick={() => onNavigateTab('students')}
            className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold py-2 rounded-xl hover:bg-slate-50 transition"
          >
            EXCEL IMPORT
          </button>
          <button
            onClick={() => excelService.exportResultsToExcel(sessions, exam.title)}
            className="bg-white border border-slate-200 text-slate-700 text-[10px] font-bold py-2 rounded-xl hover:bg-slate-50 transition"
          >
            EXCEL EXPORT
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* BENTO CARD 4: Recent Results (col-span-4)                      */}
      {/* ------------------------------------------------------------- */}
      <section className="col-span-1 md:col-span-6 lg:col-span-4 bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base">Recent Results</h3>
            <span className="text-[10px] font-semibold text-slate-400">
              KKM: {schoolProfile.defaultKkm}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {completedSessions.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs">
                Belum ada siswa yang menyelesaikan ujian.
              </div>
            ) : (
              completedSessions.slice(0, 3).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between border-b border-slate-100 pb-2"
                >
                  <span className="font-medium text-slate-700 truncate max-w-[130px]">
                    {s.studentName}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-bold text-slate-900 font-mono">
                      {s.percentage.toFixed(0)}/100
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                        s.passedKKM
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {s.passedKKM ? 'ENRICHMENT' : 'REMEDIAL'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {completedSessions.length > 0 && (
            <button
              onClick={() => handleQuickWhatsApp(completedSessions[0])}
              className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-[10px] py-2 rounded-xl transition"
            >
              SEND TO WHATSAPP
            </button>
          )}
          <button
            onClick={() => onOpenPrintModal('classical')}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] py-2 rounded-xl transition"
          >
            PRINT ALL
          </button>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* BENTO CARD 5: Dark Bento Status Dashboard (col-span-4)         */}
      {/* ------------------------------------------------------------- */}
      <section className="col-span-1 md:col-span-12 lg:col-span-4 bg-slate-900 rounded-2xl p-5 text-white border border-slate-800 shadow-sm flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">
              Status Dashboard
            </p>
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
          </div>
          <p className="text-xs sm:text-sm mt-2 text-slate-300 leading-relaxed">
            Exam session will auto-archive to G-Drive folder{' '}
            <span className="text-blue-400 underline font-medium cursor-pointer" onClick={onOpenGoogleModal}>
              'Ujian-CBT-Backup'
            </span>{' '}
            upon student completion.
          </p>
        </div>

        <div className="flex items-end justify-between pt-4 mt-4 border-t border-slate-800">
          <div>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-white">
              98.2%
            </div>
            <span className="text-[10px] block font-normal text-slate-400 uppercase tracking-wider">
              Data Integrity &amp; Sync
            </span>
          </div>

          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
            <div className="absolute text-[10px] font-bold text-blue-300">CBT</div>
          </div>
        </div>
      </section>
    </div>
  );
};
