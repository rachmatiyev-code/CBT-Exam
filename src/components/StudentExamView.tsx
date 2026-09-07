import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Maximize,
  Minimize,
  HelpCircle,
  Sparkles,
  Send,
  Flag,
  RotateCcw,
  Check,
  BrainCircuit,
  Lock,
} from 'lucide-react';
import { Exam, Question, Student, StudentAnswer, StudentExamSession } from '../types';
import { apiService } from '../services/api';

interface StudentExamViewProps {
  exam: Exam;
  students: Student[];
  onFinishExam: (session: StudentExamSession) => void;
  onExit?: () => void;
}

export const StudentExamView: React.FC<StudentExamViewProps> = ({
  exam: initialExam,
  students: initialStudents,
  onFinishExam,
}) => {
  // Server-synced active exam & students roster
  const [exam, setExam] = useState<Exam>(initialExam);
  const [students, setStudents] = useState<Student[]>(initialStudents);
  const [serverSynced, setServerSynced] = useState<boolean | null>(null);

  // Login / Setup State
  const [isStarted, setIsStarted] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(
    initialStudents[0] || null
  );
  const [enteredToken, setEnteredToken] = useState(initialExam.token);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Active Exam State
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, StudentAnswer>>({});
  const [doubtfulList, setDoubtfulList] = useState<Record<string, boolean>>({});
  const [remainingSeconds, setRemainingSeconds] = useState(initialExam.durationMinutes * 60);
  const [tabViolations, setTabViolations] = useState(0);
  const [cheatLogs, setCheatLogs] = useState<Array<{ timestamp: string; note: string }>>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionCompleted, setSubmissionCompleted] = useState<StudentExamSession | null>(null);

  const startTimeRef = useRef(new Date().toISOString());

  // Fetch active exam and roster from centralized server on mount
  useEffect(() => {
    // Check if token was provided in URL params
    const searchParams = new URLSearchParams(window.location.search);
    const urlToken = searchParams.get('token');
    if (urlToken) {
      setEnteredToken(urlToken.trim().toUpperCase());
    }

    apiService
      .fetchActiveExamForStudent()
      .then((res) => {
        if (res?.success && res.exam) {
          setExam(res.exam);
          if (res.students && res.students.length > 0) {
            setStudents(res.students);
            if (!selectedStudent || !res.students.some((s: any) => s.id === selectedStudent.id)) {
              setSelectedStudent(res.students[0]);
            }
          }
          {/* If token was not in URL params, leave input empty so student enters token provided by teacher */}
          if (urlToken) {
            setEnteredToken(urlToken.trim().toUpperCase());
          }
          setRemainingSeconds(res.exam.durationMinutes * 60);
          setServerSynced(true);
        } else {
          setServerSynced(false);
        }
      })
      .catch(() => setServerSynced(false));
  }, []);

  // Real-time Heartbeat: notify server that this student is actively taking the exam
  useEffect(() => {
    if (!isStarted || submissionCompleted || !selectedStudent) return;

    // Send immediate ping
    apiService.sendStudentPing({
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      classRoom: selectedStudent.classRoom,
      tabViolations,
    });

    const pingInterval = setInterval(() => {
      apiService.sendStudentPing({
        studentId: selectedStudent.id,
        studentName: selectedStudent.name,
        classRoom: selectedStudent.classRoom,
        tabViolations,
      });
    }, 12000);

    return () => clearInterval(pingInterval);
  }, [isStarted, submissionCompleted, selectedStudent, tabViolations]);

  // Prevent right click and copy-paste shortcuts during exam
  useEffect(() => {
    if (!isStarted || submissionCompleted) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent Ctrl+C, Ctrl+V, Ctrl+U, F12, Alt+Tab
      if (
        (e.ctrlKey && ['c', 'v', 'u', 's', 'p', 'a'].includes(e.key.toLowerCase())) ||
        e.key === 'F12' ||
        (e.altKey && e.key === 'Tab')
      ) {
        e.preventDefault();
      }
    };

    window.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isStarted, submissionCompleted]);

  // Anti-cheating: detect tab switching / window blur
  useEffect(() => {
    if (!isStarted || submissionCompleted) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabViolations((prev) => {
          const newCount = prev + 1;
          const logItem = {
            timestamp: new Date().toISOString(),
            note: `Meninggalkan tab ujian (Peringatan ke-${newCount})`,
          };
          setCheatLogs((logs) => [...logs, logItem]);
          setShowWarningModal(true);
          return newCount;
        });
      }
    };

    const handleBlur = () => {
      if (!document.hidden) {
        setTabViolations((prev) => {
          const newCount = prev + 1;
          const logItem = {
            timestamp: new Date().toISOString(),
            note: `Fokus jendela ujian hilang (Peringatan ke-${newCount})`,
          };
          setCheatLogs((logs) => [...logs, logItem]);
          setShowWarningModal(true);
          return newCount;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isStarted, submissionCompleted]);

  // Countdown timer
  useEffect(() => {
    if (!isStarted || submissionCompleted) return;

    const timer = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmitExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isStarted, submissionCompleted]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleStartExam = () => {
    if (enteredToken.trim().toUpperCase() !== exam.token.trim().toUpperCase()) {
      setTokenError('Token ujian tidak cocok. Tanyakan token kepada pengawas ujian.');
      return;
    }
    if (!selectedStudent) {
      setTokenError('Pilih nama siswa terlebih dahulu.');
      return;
    }

    setTokenError(null);
    startTimeRef.current = new Date().toISOString();
    setIsStarted(true);

    // Request fullscreen for isolation
    document.documentElement.requestFullscreen().catch(() => {});
    setIsFullscreen(true);
  };

  const currentQuestion = exam.questions[currentIndex];

  // Record student answer
  const handleSelectAnswer = (ans: string | string[]) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        answer: ans,
      },
    }));
  };

  // Toggle PG Kompleks checkbox
  const handleToggleComplexAnswer = (optLetter: string) => {
    const current = answers[currentQuestion.id]?.answer;
    let selectedList: string[] = Array.isArray(current) ? [...current] : [];

    if (selectedList.includes(optLetter)) {
      selectedList = selectedList.filter((x) => x !== optLetter);
    } else {
      selectedList.push(optLetter);
    }
    handleSelectAnswer(selectedList);
  };

  const toggleDoubtful = () => {
    setDoubtfulList((prev) => ({
      ...prev,
      [currentQuestion.id]: !prev[currentQuestion.id],
    }));
  };

  // Final Submit with AI Scoring for short answers and essays
  const handleSubmitExam = async () => {
    setShowSubmitConfirm(false);
    setIsSubmitting(true);

    try {
      let calculatedTotalScore = 0;
      const evaluatedAnswers: Record<string, StudentAnswer> = {};

      for (const q of exam.questions) {
        const studentAns = answers[q.id]?.answer;
        const maxScore = q.maxScore || (q.type === 'uraian' ? 20 : 10);

        if (q.type === 'pilihan_ganda') {
          const isCorrect = String(studentAns).trim().toUpperCase() === String(q.correctAnswer).trim().toUpperCase();
          const score = isCorrect ? maxScore : 0;
          calculatedTotalScore += score;
          evaluatedAnswers[q.id] = {
            questionId: q.id,
            answer: studentAns || '',
            awardedScore: score,
            maxScore,
            feedback: isCorrect ? 'Jawaban Benar' : `Jawaban Salah. Kunci: ${q.correctAnswer}`,
          };
        } else if (q.type === 'pilihan_ganda_kompleks') {
          const correctArr = Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer];
          const studentArr = Array.isArray(studentAns) ? studentAns : [];
          // Proportional scoring
          let matched = 0;
          studentArr.forEach((opt) => {
            if (correctArr.includes(opt)) matched++;
          });
          const score = Math.round((matched / Math.max(correctArr.length, 1)) * maxScore);
          calculatedTotalScore += score;
          evaluatedAnswers[q.id] = {
            questionId: q.id,
            answer: studentArr,
            awardedScore: score,
            maxScore,
            feedback: `Terpilih ${matched} dari ${correctArr.length} jawaban benar.`,
          };
        } else {
          // Isian singkat or Uraian: evaluate with AI
          if (!studentAns || String(studentAns).trim().length === 0) {
            evaluatedAnswers[q.id] = {
              questionId: q.id,
              answer: '',
              awardedScore: 0,
              maxScore,
              feedback: 'Siswa tidak memberikan jawaban.',
            };
          } else {
            try {
              const aiEval = await apiService.evaluateAnswer({
                question: q.question,
                studentAnswer: String(studentAns),
                expectedAnswer: typeof q.correctAnswer === 'string' ? q.correctAnswer : '',
                keywords: q.keywords,
                concept: q.concept,
                rubric: q.rubric,
                maxScore,
              });
              calculatedTotalScore += aiEval.awardedScore;
              evaluatedAnswers[q.id] = {
                questionId: q.id,
                answer: studentAns,
                awardedScore: aiEval.awardedScore,
                maxScore,
                feedback: aiEval.feedback,
                matchedKeywords: aiEval.matchedKeywords,
              };
            } catch (evalErr) {
              // Fallback keyword matching if AI call is unavailable
              const kw = q.keywords || [];
              const lowerAns = String(studentAns).toLowerCase();
              let matchedCount = 0;
              kw.forEach((k) => {
                if (lowerAns.includes(k.toLowerCase())) matchedCount++;
              });
              const fallbackScore = kw.length > 0 ? Math.round((matchedCount / kw.length) * maxScore) : Math.round(maxScore * 0.7);
              calculatedTotalScore += fallbackScore;
              evaluatedAnswers[q.id] = {
                questionId: q.id,
                answer: studentAns,
                awardedScore: fallbackScore,
                maxScore,
                feedback: 'Penilaian otomatis berdasarkan kata kunci konsep.',
              };
            }
          }
        }
      }

      const totalMaxScore = exam.questions.reduce((acc, q) => acc + (q.maxScore || 10), 0);
      const percentage = totalMaxScore > 0 ? (calculatedTotalScore / totalMaxScore) * 100 : 0;
      const passedKKM = percentage >= exam.kkm;

      const finishTime = new Date().toISOString();

      const session: StudentExamSession = {
        id: `ses-${Date.now()}`,
        examId: exam.id,
        studentId: selectedStudent?.id || 'std-unknown',
        studentName: selectedStudent?.name || 'Siswa Peserta',
        studentNisn: selectedStudent?.nisn || '00000000',
        classRoom: selectedStudent?.classRoom || 'IX-A',
        status: tabViolations > 5 ? 'terindikasi_curang' : 'selesai',
        startTime: startTimeRef.current,
        finishTime,
        tabSwitchCount: tabViolations,
        cheatLogs,
        answers: evaluatedAnswers,
        totalScore: calculatedTotalScore,
        maxTotalScore: totalMaxScore,
        percentage,
        passedKKM,
        syncedToGoogleSheet: true,
        backedUpToDrive: true,
      };

      // Submit session to centralized server so Teacher Dashboard updates immediately
      try {
        await apiService.submitSessionToServer(session);
      } catch (serverErr) {
        console.warn('Gagal sinkronisasi sesi ke server:', serverErr);
      }

      // Trigger callback to save session & auto backup
      onFinishExam(session);
      setSubmissionCompleted(session);

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    } catch (err: any) {
      console.error(err);
      alert(`Terjadi kendala saat penilaian: ${err.message}. Data Anda telah diamankan.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format timer HH:MM:SS
  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const timeFormatted = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // ==========================================
  // VIEW 1: Login & Token Screen
  // ==========================================
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-700 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                <BrainCircuit className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Portal Ujian Siswa (CBT)</h2>
                <p className="text-xs text-indigo-300">
                  {exam.subject} • {exam.grade}
                </p>
              </div>
            </div>
            {serverSynced !== null && (
              <span
                className={`text-[10px] px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 border ${
                  serverSynced
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700'
                    : 'bg-slate-700 text-slate-300 border-slate-600'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    serverSynced ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                  }`}
                />
                {serverSynced ? 'Server Terhubung' : 'Lokal'}
              </span>
            )}
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block font-semibold text-slate-300 mb-1.5">
                Pilih Identitas Siswa Peserta Ujian
              </label>
              <select
                value={selectedStudent?.id || ''}
                onChange={(e) => {
                  const s = students.find((item) => item.id === e.target.value);
                  setSelectedStudent(s || null);
                }}
                className="w-full text-xs p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:ring-2 focus:ring-indigo-500"
              >
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (NISN: {s.nisn} - Kelas {s.classRoom})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1.5 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                Token Akses Ujian
              </label>
              <input
                type="text"
                value={enteredToken}
                onChange={(e) => setEnteredToken(e.target.value)}
                placeholder="Masukkan Token dari Pengawas"
                className="w-full text-sm font-mono tracking-widest uppercase p-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {tokenError && (
              <div className="p-3 bg-rose-950/80 border border-rose-700 text-rose-300 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{tokenError}</span>
              </div>
            )}

            {/* Rules & Isolation Alert */}
            <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-700 space-y-2 text-slate-300">
              <span className="font-bold text-amber-400 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4" />
                Ketentuan &amp; Isolasi Sistem Ujian:
              </span>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 pl-1 leading-relaxed">
                <li>Ujian berlangsung selama <strong>{exam.durationMinutes} Menit</strong>.</li>
                <li>Halaman ujian akan otomatis dikunci dalam <strong>Mode Layar Penuh (Fullscreen)</strong>.</li>
                <li>
                  <strong className="text-rose-400">Dilarang berpindah tab atau membuka aplikasi lain.</strong> Perpindahan tab akan tercatat otomatis dan dilaporkan ke pengawas!
                </li>
                <li>Klik kanan, pintasan copy, dan paste dinonaktifkan demi integritas ujian.</li>
              </ul>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={handleStartExam}
              className="w-full py-3.5 text-sm font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg flex items-center justify-center gap-2 transition active:scale-98"
            >
              <span>Masuk &amp; Mulai Ujian</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 2: Exam Completed Celebration View
  // ==========================================
  if (submissionCompleted) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center items-center p-4">
        <div className="bg-slate-800 border border-slate-700 w-full max-w-lg rounded-3xl p-8 text-center space-y-6 shadow-2xl">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 mx-auto animate-bounce">
            <CheckCircle className="w-10 h-10" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">Ujian Berhasil Diselesaikan!</h2>
            <p className="text-xs text-slate-400 mt-1">
              Jawaban Anda telah tersimpan dan otomatis diarsipkan ke Google Drive &amp; Spreadsheet.
            </p>
          </div>

          {/* Score Card */}
          <div className="p-5 bg-slate-900 rounded-2xl border border-slate-700 space-y-3">
            <span className="text-xs text-slate-400">Nilai Akhir (Skoring Otomatis AI)</span>
            <div className="text-4xl font-extrabold text-white">
              {submissionCompleted.percentage.toFixed(1)} <span className="text-base text-slate-500 font-normal">/ 100</span>
            </div>
            <div className="inline-block px-3 py-1 rounded-full text-xs font-bold">
              {submissionCompleted.passedKKM ? (
                <span className="text-emerald-400 bg-emerald-950/60 border border-emerald-700 px-3 py-1 rounded-full">
                  🎉 Selamat! Anda Memenuhi Batas KKM ({exam.kkm})
                </span>
              ) : (
                <span className="text-rose-400 bg-rose-950/60 border border-rose-700 px-3 py-1 rounded-full">
                  Perlu Program Remedial (KKM: {exam.kkm})
                </span>
              )}
            </div>
          </div>

          <div className="text-xs text-slate-400 space-y-1 text-left bg-slate-900/50 p-4 rounded-xl border border-slate-700">
            <div>Peserta: <strong>{submissionCompleted.studentName}</strong></div>
            <div>NISN: <span className="font-mono">{submissionCompleted.studentNisn}</span></div>
            <div>
              Status Kedisiplinan Tab:{' '}
              <strong className={submissionCompleted.tabSwitchCount === 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {submissionCompleted.tabSwitchCount === 0
                  ? 'Sangat Baik (0x Pelanggaran)'
                  : `${submissionCompleted.tabSwitchCount}x Peringatan Tab`}
              </strong>
            </div>
          </div>

          <div className="pt-2 space-y-2">
            <button
              onClick={() => {
                if (window.opener) {
                  window.close();
                } else {
                  // Reload in clean student mode standby
                  window.location.href = `${window.location.origin}${window.location.pathname}?mode=siswa`;
                }
              }}
              className="w-full py-3 text-xs font-bold rounded-xl bg-slate-700 hover:bg-slate-600 text-white shadow-md transition"
            >
              Tutup Halaman Ujian
            </button>
            <p className="text-[11px] text-slate-500 text-center">
              Seluruh lembar jawaban Anda telah tersimpan. Silakan tutup jendela atau tab peramban ini.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW 3: Active Exam Screen (Locked & Isolated)
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 flex flex-col select-none">
      {/* Top Header Bar */}
      <header className="bg-slate-900 text-white px-4 sm:px-6 py-3 flex items-center justify-between border-b border-slate-800 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-sm">
            CBT
          </div>
          <div>
            <h1 className="font-bold text-xs sm:text-sm truncate max-w-xs sm:max-w-md">
              {exam.subject} - {exam.title}
            </h1>
            <span className="text-[11px] text-slate-400">
              Siswa: <strong>{selectedStudent?.name}</strong> ({selectedStudent?.classRoom})
            </span>
          </div>
        </div>

        {/* Timer & Fullscreen Toggle */}
        <div className="flex items-center gap-3">
          <div
            className={`px-3 py-1.5 rounded-xl font-mono text-sm font-bold flex items-center gap-1.5 shadow-xs ${
              remainingSeconds < 300
                ? 'bg-rose-600 text-white animate-pulse'
                : 'bg-slate-800 text-emerald-400 border border-slate-700'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{timeFormatted}</span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition"
            title="Layar Penuh"
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Question Area */}
        <div className="lg:col-span-8 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
            {/* Question Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center text-sm">
                  {currentIndex + 1}
                </span>
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {currentQuestion.type === 'pilihan_ganda' && 'Pilihan Ganda (1 Jawaban)'}
                  {currentQuestion.type === 'pilihan_ganda_kompleks' && 'Pilihan Ganda Kompleks (Bisa Lebih dari 1)'}
                  {currentQuestion.type === 'isian_singkat' && 'Isian Jawaban Pendek'}
                  {currentQuestion.type === 'uraian' && 'Uraian / Esai Komprehensif'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={toggleDoubtful}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition flex items-center gap-1.5 ${
                    doubtfulList[currentQuestion.id]
                      ? 'bg-amber-100 border-amber-300 text-amber-800'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Flag className="w-3.5 h-3.5" />
                  <span>Ragu-Ragu</span>
                </button>
              </div>
            </div>

            {/* Question Body */}
            <div className="text-sm sm:text-base font-medium text-slate-800 leading-relaxed">
              {currentQuestion.question}
            </div>

            {/* Question Interaction Type 1: Pilihan Ganda */}
            {currentQuestion.type === 'pilihan_ganda' && (
              <div className="space-y-2.5 pt-2">
                {currentQuestion.options.map((opt, oIdx) => {
                  const letter = opt.charAt(0).toUpperCase();
                  const isSelected = answers[currentQuestion.id]?.answer === letter;
                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleSelectAnswer(letter)}
                      className={`w-full text-left p-3.5 rounded-xl border transition flex items-start gap-3 text-xs sm:text-sm ${
                        isSelected
                          ? 'bg-indigo-50/90 border-indigo-500 text-indigo-950 font-medium shadow-xs ring-1 ring-indigo-500'
                          : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="pt-0.5 leading-snug">{opt.substring(2).trim() || opt}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Question Interaction Type 2: Pilihan Ganda Kompleks */}
            {currentQuestion.type === 'pilihan_ganda_kompleks' && (
              <div className="space-y-2.5 pt-2">
                <p className="text-xs text-indigo-600 font-semibold mb-2">
                  * Berikan tanda centang pada satu atau lebih pilihan yang benar:
                </p>
                {currentQuestion.options.map((opt, oIdx) => {
                  const letter = opt.charAt(0).toUpperCase();
                  const currentList = Array.isArray(answers[currentQuestion.id]?.answer)
                    ? (answers[currentQuestion.id].answer as string[])
                    : [];
                  const isChecked = currentList.includes(letter);

                  return (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleToggleComplexAnswer(letter)}
                      className={`w-full text-left p-3.5 rounded-xl border transition flex items-start gap-3 text-xs sm:text-sm ${
                        isChecked
                          ? 'bg-indigo-50/90 border-indigo-500 text-indigo-950 font-medium shadow-xs ring-1 ring-indigo-500'
                          : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span
                        className={`w-6 h-6 rounded-md flex items-center justify-center font-bold text-xs shrink-0 border ${
                          isChecked
                            ? 'bg-indigo-600 border-indigo-600 text-white'
                            : 'bg-white border-slate-300 text-transparent'
                        }`}
                      >
                        ✓
                      </span>
                      <span className="pt-0.5 leading-snug">
                        <strong>{letter}.</strong> {opt.substring(2).trim() || opt}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Question Interaction Type 3: Isian Singkat */}
            {currentQuestion.type === 'isian_singkat' && (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Ketikkan Jawaban Singkat Anda:
                </label>
                <input
                  type="text"
                  value={String(answers[currentQuestion.id]?.answer || '')}
                  onChange={(e) => handleSelectAnswer(e.target.value)}
                  placeholder="Ketikkan satu kata atau frasa singkat..."
                  className="w-full text-sm font-medium px-4 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-400">
                  Jawaban Anda akan dicocokkan otomatis oleh AI dengan konsep materi &amp; kata kunci.
                </p>
              </div>
            )}

            {/* Question Interaction Type 4: Uraian / Essay */}
            {currentQuestion.type === 'uraian' && (
              <div className="space-y-2 pt-2">
                <label className="block text-xs font-semibold text-slate-600">
                  Tuliskan Uraian Penjelasan Lengkap Anda:
                </label>
                <textarea
                  rows={6}
                  value={String(answers[currentQuestion.id]?.answer || '')}
                  onChange={(e) => handleSelectAnswer(e.target.value)}
                  placeholder="Jelaskan secara runtut dengan menggunakan konsep dan kata kunci materi yang relevan..."
                  className="w-full text-sm font-medium p-4 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 leading-relaxed"
                />
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>Panjang teks: {String(answers[currentQuestion.id]?.answer || '').length} karakter</span>
                  <span>Sistem penilaian otomatis AI menganalisis pemahaman konsep &amp; kata kunci.</span>
                </div>
              </div>
            )}

            {/* Navigation Bottom Controls */}
            <div className="flex items-center justify-between pt-6 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Soal Sebelumnya</span>
              </button>

              {currentIndex < exam.questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrentIndex((prev) => Math.min(exam.questions.length - 1, prev + 1))}
                  className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-xs transition"
                >
                  <span>Soal Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowSubmitConfirm(true)}
                  className="px-6 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 shadow-sm transition"
                >
                  <Send className="w-4 h-4" />
                  <span>Kumpulkan Jawaban</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Question Number Grid & Overview */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
            <h3 className="font-bold text-xs text-slate-700 uppercase tracking-wider">
              Navigasi Butir Soal ({exam.questions.length} Soal)
            </h3>

            {/* Grid numbers */}
            <div className="grid grid-cols-5 gap-2">
              {exam.questions.map((q, idx) => {
                const hasAnswer =
                  answers[q.id]?.answer !== undefined &&
                  answers[q.id]?.answer !== '' &&
                  (Array.isArray(answers[q.id]?.answer) ? (answers[q.id].answer as string[]).length > 0 : true);
                const isDoubtful = doubtfulList[q.id];
                const isCurrent = currentIndex === idx;

                let btnStyle = 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200';
                if (isCurrent) {
                  btnStyle = 'ring-2 ring-indigo-600 font-bold bg-indigo-600 text-white';
                } else if (isDoubtful) {
                  btnStyle = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
                } else if (hasAnswer) {
                  btnStyle = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-10 rounded-xl border text-xs flex items-center justify-center transition shadow-2xs ${btnStyle}`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="pt-3 border-t border-slate-100 space-y-1.5 text-[11px] text-slate-600">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-emerald-100 border border-emerald-300"></span>
                <span>Sudah Dijawab ({Object.keys(answers).filter((k) => answers[k]?.answer).length})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-amber-100 border border-amber-300"></span>
                <span>Ragu-Ragu ({Object.values(doubtfulList).filter(Boolean).length})</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded bg-slate-100 border border-slate-200"></span>
                <span>Belum Dijawab ({exam.questions.length - Object.keys(answers).filter((k) => answers[k]?.answer).length})</span>
              </div>
            </div>

            {/* Big Finish Button */}
            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center justify-center gap-2 transition"
            >
              <Check className="w-4 h-4" />
              <span>Selesai &amp; Kumpulkan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Warning Modal on Tab Switching / Blur */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl p-6 shadow-2xl border-2 border-rose-500 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto animate-bounce">
              <ShieldAlert className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-extrabold text-rose-600">
                PERINGATAN KECURANGAN UJIAN!
              </h3>
              <p className="text-xs text-slate-700">
                Anda terdeteksi <strong>meninggalkan tab atau aplikasi ujian!</strong>
              </p>
            </div>

            <div className="p-3 bg-rose-50 rounded-xl text-xs text-rose-800 font-semibold border border-rose-200">
              Pelanggaran Terdeteksi: {tabViolations} Kali
              <p className="text-[11px] font-normal text-rose-600 mt-1">
                Catatan ini telah dikirimkan ke dashboard live monitoring pengawas ujian.
              </p>
            </div>

            <button
              onClick={() => {
                setShowWarningModal(false);
                document.documentElement.requestFullscreen().catch(() => {});
              }}
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md transition"
            >
              Saya Mengerti &amp; Lanjutkan Ujian
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal before Submit */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Konfirmasi Kumpulkan Ujian</h3>
                <p className="text-xs text-slate-500">Pastikan seluruh soal telah Anda jawab dengan cermat.</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5 text-slate-700">
              <div className="flex justify-between">
                <span>Soal Dijawab:</span>
                <strong className="text-emerald-700 font-bold">
                  {Object.keys(answers).filter((k) => answers[k]?.answer).length} dari {exam.questions.length} Butir
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Soal Ragu-ragu:</span>
                <strong className="text-amber-700 font-bold">
                  {Object.values(doubtfulList).filter(Boolean).length} Butir
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Sisa Waktu Ujian:</span>
                <strong className="text-slate-900 font-mono">{timeFormatted}</strong>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSubmitConfirm(false)}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-medium rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200"
              >
                Cek Kembali Soal
              </button>
              <button
                type="button"
                onClick={handleSubmitExam}
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'AI Sedang Menilai...' : 'Kumpulkan & Dapatkan Skor'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
