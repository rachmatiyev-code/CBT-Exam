import React, { useState, useEffect } from 'react';
import {
  initialExam,
  initialSchoolProfile,
  initialStudents,
  initialSessions,
  initialAppsScriptSettings,
  initialExamPackages,
} from './data/defaultData';
import {
  Exam,
  SchoolProfile,
  Student,
  StudentExamSession,
  AppsScriptSettings,
  ExamPackage,
} from './types';
import { apiService } from './services/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { BentoDashboard } from './components/BentoDashboard';
import { QuestionBankTab } from './components/QuestionBankTab';
import { SchoolAndStudentsTab } from './components/SchoolAndStudentsTab';
import { LiveMonitoringTab } from './components/LiveMonitoringTab';
import { ExamResultsTab } from './components/ExamResultsTab';
import { StudentExamView } from './components/StudentExamView';
import { GeminiKeyModal } from './components/GeminiKeyModal';
import { GoogleIntegrationModal } from './components/GoogleIntegrationModal';
import { AiQuestionModal } from './components/AiQuestionModal';
import { PrintReportModal } from './components/PrintReportModal';
import { ShareStudentLinkModal } from './components/ShareStudentLinkModal';
import { CheckCircle, X, AlertCircle, Copy, Check } from 'lucide-react';
import { copyToClipboard } from './utils/clipboard';

export default function App() {
  // Check if opened directly in student mode via URL param (?mode=siswa)
  const isUrlStudentMode =
    typeof window !== 'undefined' && window.location.search.includes('mode=siswa');

  // Core Persistent State
  const [exam, setExam] = useState<Exam>(() => {
    const saved = localStorage.getItem('educbt_exam');
    return saved ? JSON.parse(saved) : initialExam;
  });

  const [examPackages, setExamPackages] = useState<ExamPackage[]>(() => {
    const saved = localStorage.getItem('educbt_exam_packages');
    return saved ? JSON.parse(saved) : initialExamPackages;
  });

  const [schoolProfile, setSchoolProfile] = useState<SchoolProfile>(() => {
    const saved = localStorage.getItem('educbt_school');
    return saved ? JSON.parse(saved) : initialSchoolProfile;
  });

  const [students, setStudents] = useState<Student[]>(() => {
    const saved = localStorage.getItem('educbt_students');
    return saved ? JSON.parse(saved) : initialStudents;
  });

  const [classes, setClasses] = useState<string[]>(() => {
    const saved = localStorage.getItem('educbt_classes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    const defaultClasses = Array.from(
      new Set(initialStudents.map((s) => s.classRoom).filter(Boolean))
    ).sort();
    return defaultClasses.length > 0 ? defaultClasses : ['IX-A', 'IX-B', 'IX-C'];
  });

  const [sessions, setSessions] = useState<StudentExamSession[]>(() => {
    const saved = localStorage.getItem('educbt_sessions');
    return saved ? JSON.parse(saved) : initialSessions;
  });

  const [googleSettings, setGoogleSettings] = useState<AppsScriptSettings>(() => {
    const saved = localStorage.getItem('educbt_gas_config');
    return saved ? JSON.parse(saved) : initialAppsScriptSettings;
  });

  // UI state
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'questions' | 'students' | 'monitoring' | 'results'
  >('dashboard');
  const [isStudentModeActive, setIsStudentModeActive] = useState(isUrlStudentMode);
  const [hasGeminiKey, setHasGeminiKey] = useState(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [isAiQuestionModalOpen, setIsAiQuestionModalOpen] = useState(false);
  const [isShareLinkModalOpen, setIsShareLinkModalOpen] = useState(false);
  const [backupToast, setBackupToast] = useState<string | null>(null);
  const [errorToast, setErrorToast] = useState<{ message: string; title?: string } | null>(null);
  const [errorToastCopied, setErrorToastCopied] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Global listener for copyable errors triggered from anywhere in the app
  useEffect(() => {
    const errorHandler = (e: any) => {
      if (e.detail?.message) {
        setErrorToast({
          message: e.detail.message,
          title: e.detail.title || 'Kendala Layanan',
        });
      }
    };
    window.addEventListener('educbt:error' as any, errorHandler);
    return () => window.removeEventListener('educbt:error' as any, errorHandler);
  }, []);

  // Print modal state
  const [printConfig, setPrintConfig] = useState<{
    isOpen: boolean;
    type: 'individual' | 'classical' | 'questions';
    session?: StudentExamSession;
  }>({
    isOpen: false,
    type: 'classical',
  });

  // Real-time server sync state
  const [activePings, setActivePings] = useState<any[]>([]);
  const [isServerSyncing, setIsServerSyncing] = useState(false);

  // Check Gemini Key presence on load (custom key or server-side GEMINI_API_KEY)
  useEffect(() => {
    const key = apiService.getStoredApiKey();
    if (key) {
      setHasGeminiKey(true);
    } else {
      apiService.checkServerKeyStatus().then((res) => {
        setHasGeminiKey(res.hasServerKey);
      });
    }
  }, []);

  // 1. Initial Centralized Server Sync on App Startup
  useEffect(() => {
    apiService
      .fetchServerState()
      .then((res) => {
        if (res?.success && res.data) {
          const {
            exam: sExam,
            schoolProfile: sSchool,
            students: sStudents,
            packages: sPackages,
            sessions: sSessions,
          } = res.data;

          if (sExam) setExam(sExam);
          if (sSchool) setSchoolProfile(sSchool);
          if (sStudents && sStudents.length > 0) setStudents(sStudents);
          if (res.data.classes && Array.isArray(res.data.classes) && res.data.classes.length > 0) {
            setClasses(res.data.classes);
          }
          if (sPackages && sPackages.length > 0) setExamPackages(sPackages);
          if (sSessions && sSessions.length > 0) setSessions(sSessions);

          // If server was fresh/empty, initialize server with default app state
          if (!sExam) {
            apiService.syncTeacherToServer({
              exam,
              schoolProfile,
              students,
              classes,
              packages: examPackages,
            });
          }
        }
      })
      .catch((err) => console.warn('Pemuatan state server terpusat:', err));
  }, []);

  // 2. Poll live student sessions & active heartbeats from server
  useEffect(() => {
    const pollInterval = setInterval(() => {
      apiService
        .fetchLiveSessions()
        .then((res) => {
          if (res?.success) {
            if (res.sessions && Array.isArray(res.sessions)) {
              setSessions((prev) => {
                const prevStr = JSON.stringify(prev);
                const nextStr = JSON.stringify(res.sessions);
                if (prevStr !== nextStr) {
                  return res.sessions!;
                }
                return prev;
              });
            }
            if (res.activePings && Array.isArray(res.activePings)) {
              setActivePings(res.activePings);
            }
          }
        })
        .catch(() => {});
    }, 4000);

    return () => clearInterval(pollInterval);
  }, []);

  // Manual refresh handler for Live Monitoring
  const handleRefreshLiveSessions = async () => {
    setIsServerSyncing(true);
    try {
      const res = await apiService.fetchLiveSessions();
      if (res?.success) {
        if (res.sessions) setSessions(res.sessions);
        if (res.activePings) setActivePings(res.activePings);
      }
    } catch (e) {
      console.warn('Refresh live sessions error:', e);
    } finally {
      setTimeout(() => setIsServerSyncing(false), 500);
    }
  };

  // Sync to localStorage & Central Server
  useEffect(() => {
    localStorage.setItem('educbt_exam', JSON.stringify(exam));
    apiService.syncTeacherToServer({ exam });
  }, [exam]);

  useEffect(() => {
    localStorage.setItem('educbt_exam_packages', JSON.stringify(examPackages));
    apiService.syncTeacherToServer({ packages: examPackages });
  }, [examPackages]);

  useEffect(() => {
    localStorage.setItem('educbt_school', JSON.stringify(schoolProfile));
    apiService.syncTeacherToServer({ schoolProfile });
  }, [schoolProfile]);

  useEffect(() => {
    localStorage.setItem('educbt_students', JSON.stringify(students));
    apiService.syncTeacherToServer({ students, classes });
  }, [students]);

  useEffect(() => {
    localStorage.setItem('educbt_classes', JSON.stringify(classes));
    apiService.syncTeacherToServer({ classes, students });
  }, [classes]);

  useEffect(() => {
    localStorage.setItem('educbt_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    localStorage.setItem('educbt_gas_config', JSON.stringify(googleSettings));
  }, [googleSettings]);

  // Automated Google Drive & Sheets Backup Routine
  const triggerAutoBackup = async (customMessage?: string) => {
    const nowStr = new Date().toLocaleString('id-ID');
    setGoogleSettings((prev) => ({ ...prev, lastSyncTime: nowStr }));

    let gasSuccess = false;
    try {
      if (googleSettings.webAppUrl) {
        const res = await apiService.syncWithGAS(
          'backup_all',
          {
            school: schoolProfile,
            exam,
            sessions,
            timestamp: new Date().toISOString(),
          },
          googleSettings.webAppUrl
        );
        gasSuccess = !!res?.success;
      }
    } catch (e) {
      console.warn('GAS Sync note:', e);
    }

    const msg =
      customMessage ||
      (gasSuccess
        ? `Backup Google Drive berhasil! Folder: /Ujian-CBT-Backup telah disinkronkan.`
        : `Perubahan tersimpan di database lokal & server EduCBT.`);
    setBackupToast(msg);
    setTimeout(() => setBackupToast(null), 4000);
  };

  // Launch isolated student mode in a new browser tab or current tab
  const handleLaunchStudentMode = (newTab: boolean = true) => {
    if (newTab) {
      const origin = window.location.origin;
      const pathname = window.location.pathname;
      const studentUrl = `${origin}${pathname}?mode=siswa`;
      window.open(studentUrl, '_blank', 'noopener,noreferrer');
    } else {
      setIsStudentModeActive(true);
    }
  };

  // Handle student exam submission
  const handleFinishStudentExam = (newSession: StudentExamSession) => {
    setSessions((prev) => {
      const exists = prev.some((s) => s.id === newSession.id || s.studentId === newSession.studentId);
      if (exists) {
        return prev.map((s) => (s.studentId === newSession.studentId ? newSession : s));
      }
      return [newSession, ...prev];
    });

    triggerAutoBackup(
      `Siswa ${newSession.studentName} menyelesaikan ujian! Hasil otomatis diarsipkan ke Google Drive subfolder /Hasil-Ujian & Spreadsheet.`
    );
  };

  // If student mode is active in this tab (via ?mode=siswa or launch button)
  if (isStudentModeActive) {
    return (
      <StudentExamView
        exam={exam}
        students={students}
        onFinishExam={handleFinishStudentExam}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-900 overflow-hidden select-none">
      {/* 1. Desktop Left Bento Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          schoolProfile={schoolProfile}
          activeExam={exam}
          hasGeminiKey={hasGeminiKey}
          onOpenGeminiModal={() => setIsGeminiModalOpen(true)}
          onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
          googleSettings={googleSettings}
        />
      </div>

      {/* Mobile Drawer Sidebar */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 bg-slate-900 h-full flex flex-col shadow-2xl">
            <div className="flex justify-end p-2 border-b border-slate-800">
              <button
                onClick={() => setMobileSidebarOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <Sidebar
              activeTab={activeTab}
              setActiveTab={(tab) => {
                setActiveTab(tab);
                setMobileSidebarOpen(false);
              }}
              schoolProfile={schoolProfile}
              activeExam={exam}
              hasGeminiKey={hasGeminiKey}
              onOpenGeminiModal={() => {
                setIsGeminiModalOpen(true);
                setMobileSidebarOpen(false);
              }}
              onOpenGoogleModal={() => {
                setIsGoogleModalOpen(true);
                setMobileSidebarOpen(false);
              }}
              googleSettings={googleSettings}
            />
          </div>
        </div>
      )}

      {/* 2. Main Bento Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Top Header */}
        <Header
          schoolProfile={schoolProfile}
          activeExam={exam}
          hasGeminiKey={hasGeminiKey}
          activePingsCount={activePings.length}
          onOpenGeminiModal={() => setIsGeminiModalOpen(true)}
          onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
          onOpenShareLinkModal={() => setIsShareLinkModalOpen(true)}
          onLaunchStudentMode={handleLaunchStudentMode}
          onToggleMobileSidebar={() => setMobileSidebarOpen(!mobileSidebarOpen)}
        />

        {/* Global Copyable Error Toast */}
        {errorToast && (
          <div className="bg-rose-700 text-white px-4 py-2.5 text-xs shadow-md flex items-center justify-between transition-all animate-in slide-in-from-top shrink-0 border-b border-rose-800">
            <div className="flex items-center gap-3 max-w-7xl mx-auto w-full">
              <AlertCircle className="w-4 h-4 text-rose-200 shrink-0" />
              <div className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="truncate">
                  {errorToast.title && (
                    <span className="font-bold mr-2 text-rose-100">
                      [{errorToast.title}]
                    </span>
                  )}
                  <span className="select-text font-mono text-[11px] bg-rose-800/90 px-2 py-0.5 rounded border border-rose-600/60 inline-block">
                    {errorToast.message}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyToClipboard(errorToast.message);
                      if (ok) {
                        setErrorToastCopied(true);
                        setTimeout(() => setErrorToastCopied(false), 2500);
                      }
                    }}
                    className={`px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-colors shadow-xs ${
                      errorToastCopied
                        ? 'bg-emerald-500 text-white'
                        : 'bg-white text-rose-900 hover:bg-rose-100'
                    }`}
                    title="Salin pesan error ke clipboard"
                  >
                    {errorToastCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-white" />
                        <span>Error Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-rose-700" />
                        <span>Salin Error</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => setErrorToast(null)}
                    className="text-white/80 hover:text-white p-1 rounded hover:bg-rose-800"
                    title="Tutup notifikasi"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Auto Backup Notification Toast */}
        {backupToast && (
          <div className="bg-emerald-600 text-white px-4 py-2.5 text-xs font-semibold shadow-xs flex items-center justify-between transition-all animate-in slide-in-from-top shrink-0">
            <div className="flex items-center gap-2 max-w-7xl mx-auto w-full">
              <CheckCircle className="w-4 h-4 text-emerald-200 shrink-0" />
              <span className="select-text">{backupToast}</span>
            </div>
            <button onClick={() => setBackupToast(null)} className="text-white/80 hover:text-white text-xs">
              ✕
            </button>
          </div>
        )}

        {/* Dynamic Body Content Container */}
        <div className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {/* Quick Breadcrumb / Tab Indicator Pill */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                Active View
              </span>
              <span className="text-slate-300">•</span>
              <span className="font-bold text-slate-800">
                {activeTab === 'dashboard' && 'Bento Grid Dashboard Overview'}
                {activeTab === 'questions' && 'AI Question Bank & Generator'}
                {activeTab === 'monitoring' && 'Live Student Monitoring (Anti-Curang)'}
                {activeTab === 'students' && 'Student & Class Management'}
                {activeTab === 'results' && 'Exam Results, Remidi & Pengayaan'}
              </span>
            </div>

            {activeTab !== 'dashboard' && (
              <button
                onClick={() => setActiveTab('dashboard')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-2.5 py-1 rounded-lg transition"
              >
                ← Kembali ke Bento Dashboard
              </button>
            )}
          </div>

          {/* VIEW: BENTO GRID DASHBOARD */}
          {activeTab === 'dashboard' && (
            <BentoDashboard
              exam={exam}
              schoolProfile={schoolProfile}
              students={students}
              sessions={sessions}
              googleSettings={googleSettings}
              onOpenAiGenerator={() => setIsAiQuestionModalOpen(true)}
              onOpenGoogleModal={() => setIsGoogleModalOpen(true)}
              onOpenShareLinkModal={() => setIsShareLinkModalOpen(true)}
              onNavigateTab={setActiveTab}
              onOpenPrintModal={(type, session) => {
                setPrintConfig({ isOpen: true, type, session });
              }}
              onTriggerBackup={() => triggerAutoBackup()}
              onLaunchStudentMode={handleLaunchStudentMode}
            />
          )}

          {/* VIEW: QUESTIONS TAB */}
          {activeTab === 'questions' && (
            <QuestionBankTab
              exam={exam}
              packages={examPackages}
              onUpdateExam={(updated) => {
                setExam(updated);
                triggerAutoBackup(
                  'Perubahan bank soal berhasil disimpan dan diarsipkan ke Google Drive subfolder /Soal-Ujian.'
                );
              }}
              onSaveToHistory={(newPackage) => {
                const exists = examPackages.some(
                  (p) => p.id === newPackage.id || p.code.toLowerCase() === newPackage.code.toLowerCase()
                );
                const updated = exists
                  ? examPackages.map((p) =>
                      p.id === newPackage.id || p.code.toLowerCase() === newPackage.code.toLowerCase()
                        ? newPackage
                        : p
                    )
                  : [newPackage, ...examPackages];
                setExamPackages(updated);
                triggerAutoBackup(`Paket soal "${newPackage.title}" (${newPackage.code}) berhasil disimpan ke riwayat.`);
              }}
              onLoadPackage={(pkg) => {
                setExam({
                  ...exam,
                  id: pkg.id,
                  code: pkg.code,
                  token: pkg.token,
                  title: pkg.title,
                  subject: pkg.subject,
                  grade: pkg.grade,
                  semester: pkg.semester,
                  durationMinutes: pkg.durationMinutes,
                  kkm: pkg.kkm,
                  educationGoal: pkg.educationGoal,
                  coreMaterial: pkg.coreMaterial,
                  questions: pkg.questions,
                });
                triggerAutoBackup(`Paket soal "${pkg.title}" (${pkg.code}) berhasil dimuat beserta Token ${pkg.token}!`);
              }}
              onDeletePackage={(packageId) => {
                setExamPackages(examPackages.filter((p) => p.id !== packageId));
                triggerAutoBackup('Paket soal berhasil dihapus dari riwayat.');
              }}
              onOpenAiGenerator={() => setIsAiQuestionModalOpen(true)}
              onOpenPrintQuestions={() => {
                setPrintConfig({ isOpen: true, type: 'questions' });
              }}
              onTriggerBackup={() => triggerAutoBackup()}
            />
          )}

          {/* VIEW: STUDENTS TAB */}
          {activeTab === 'students' && (
            <SchoolAndStudentsTab
              schoolProfile={schoolProfile}
              onUpdateSchool={(updated) => {
                setSchoolProfile(updated);
                triggerAutoBackup('Profil satuan pendidikan diperbarui.');
              }}
              students={students}
              onUpdateStudents={(updated) => {
                setStudents(updated);
                triggerAutoBackup('Data peserta ujian diperbarui dan disinkronkan.');
              }}
              classes={classes}
              onUpdateClasses={(updated) => {
                setClasses(updated);
                triggerAutoBackup('Daftar kelas rombel diperbarui.');
              }}
              onTriggerBackup={() => triggerAutoBackup()}
            />
          )}

          {/* VIEW: MONITORING TAB */}
          {activeTab === 'monitoring' && (
            <LiveMonitoringTab
              exam={exam}
              students={students}
              sessions={sessions}
              activePings={activePings}
              onRefreshLive={handleRefreshLiveSessions}
              isSyncing={isServerSyncing}
              onOpenShareLinkModal={() => setIsShareLinkModalOpen(true)}
              onUpdateSession={(updated) => {
                setSessions(sessions.map((s) => (s.id === updated.id ? updated : s)));
                triggerAutoBackup();
              }}
              onDeleteSession={async (sessionId) => {
                setSessions((prev) => prev.filter((s) => s.id !== sessionId));
                await apiService.deleteSessionFromServer(sessionId);
                triggerAutoBackup('Sesi ujian siswa telah direset.');
              }}
              onSelectStudentForDetail={() => {
                setActiveTab('results');
              }}
            />
          )}

          {/* VIEW: RESULTS TAB */}
          {activeTab === 'results' && (
            <ExamResultsTab
              exam={exam}
              schoolProfile={schoolProfile}
              students={students}
              sessions={sessions}
              onUpdateSession={(updated) => {
                setSessions(sessions.map((s) => (s.id === updated.id ? updated : s)));
                triggerAutoBackup();
              }}
              onDeleteSession={async (sessionId) => {
                setSessions((prev) => prev.filter((s) => s.id !== sessionId));
                await apiService.deleteSessionFromServer(sessionId);
                triggerAutoBackup('Hasil ujian siswa telah dihapus.');
              }}
              onResetSessions={async (sessionIds) => {
                setSessions((prev) => prev.filter((s) => !sessionIds.includes(s.id)));
                await apiService.batchDeleteSessionsFromServer(sessionIds);
                triggerAutoBackup(`${sessionIds.length} sesi ujian siswa direset agar dapat mengerjakan ulang.`);
              }}
              onOpenPrintModal={(type, session) => {
                setPrintConfig({
                  isOpen: true,
                  type,
                  session,
                });
              }}
            />
          )}
        </div>
      </main>

      {/* MODALS */}
      {/* 1. Gemini Key Modal */}
      <GeminiKeyModal
        isOpen={isGeminiModalOpen}
        onClose={() => setIsGeminiModalOpen(false)}
        onKeySaved={() => setHasGeminiKey(true)}
      />

      {/* 2. Google Integration Modal */}
      <GoogleIntegrationModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        settings={googleSettings}
        onSaveSettings={(updated) => {
          setGoogleSettings(updated);
          triggerAutoBackup('Koneksi Google Apps Script berhasil diperbarui!');
        }}
        activeExam={exam}
        completedSessions={sessions.filter((s) => s.status === 'selesai')}
        onTriggerBackup={() => triggerAutoBackup()}
      />

      {/* 3. AI Question Generator Modal */}
      <AiQuestionModal
        isOpen={isAiQuestionModalOpen}
        onClose={() => setIsAiQuestionModalOpen(false)}
        exam={exam}
        onAddQuestions={(newQuestions) => {
          setExam((prev) => ({
            ...prev,
            questions: [...prev.questions, ...newQuestions],
          }));
          triggerAutoBackup(
            `Berhasil menambahkan ${newQuestions.length} butir soal AI baru ke Google Drive /Soal-Ujian!`
          );
        }}
      />

      {/* 4. Print Report Modal */}
      {printConfig.isOpen && (
        <PrintReportModal
          type={printConfig.type}
          exam={exam}
          schoolProfile={schoolProfile}
          sessions={sessions}
          individualSession={printConfig.session}
          onClose={() => setPrintConfig({ ...printConfig, isOpen: false })}
        />
      )}

      {/* 5. Dedicated Share Student Mode Link Modal */}
      <ShareStudentLinkModal
        isOpen={isShareLinkModalOpen}
        onClose={() => setIsShareLinkModalOpen(false)}
        exam={exam}
        schoolProfile={schoolProfile}
      />
    </div>
  );
}
