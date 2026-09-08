import React, { useState } from 'react';
import {
  Award,
  Printer,
  Sparkles,
  Phone,
  Mail,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Share2,
  Eye,
  BookOpen,
  Send,
  HelpCircle,
  Lightbulb,
  Target,
  Quote,
  ChevronRight,
  Edit3,
  Trash2,
  RotateCcw,
  CheckSquare,
  Square,
  X,
  Save,
  Calculator,
  SlidersHorizontal,
} from 'lucide-react';
import { Exam, SchoolProfile, Student, StudentExamSession } from '../types';
import { apiService } from '../services/api';
import { excelService } from '../services/gasSync';

interface ExamResultsTabProps {
  exam: Exam;
  schoolProfile: SchoolProfile;
  students: Student[];
  sessions: StudentExamSession[];
  onUpdateSession: (updated: StudentExamSession) => void;
  onDeleteSession?: (sessionId: string) => void;
  onResetSessions?: (sessionIds: string[]) => void;
  onOpenPrintModal: (type: 'individual' | 'classical', session?: StudentExamSession) => void;
}

export const ExamResultsTab: React.FC<ExamResultsTabProps> = ({
  exam,
  schoolProfile,
  students,
  sessions,
  onUpdateSession,
  onDeleteSession,
  onResetSessions,
  onOpenPrintModal,
}) => {
  const [selectedSession, setSelectedSession] = useState<StudentExamSession | null>(
    sessions.find((s) => s.status === 'selesai') || sessions[0] || null
  );
  const [generatingAi, setGeneratingAi] = useState(false);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [editingSession, setEditingSession] = useState<StudentExamSession | null>(null);
  const [editScore, setEditScore] = useState<number>(0);
  const [editPassed, setEditPassed] = useState<boolean>(true);
  const [editNotes, setEditNotes] = useState<string>('');

  const completedSessions = sessions.filter((s) => s.status === 'selesai');

  // Sorted by score descending for ranking
  const rankedSessions = [...completedSessions].sort((a, b) => b.percentage - a.percentage);

  // Statistics
  const totalCompleted = completedSessions.length;
  const averageScore =
    totalCompleted > 0
      ? rankedSessions.reduce((acc, s) => acc + s.percentage, 0) / totalCompleted
      : 0;
  const highestScore = totalCompleted > 0 ? Math.max(...rankedSessions.map((s) => s.percentage)) : 0;
  const lowestScore = totalCompleted > 0 ? Math.min(...rankedSessions.map((s) => s.percentage)) : 0;
  const passedCount = rankedSessions.filter((s) => s.passedKKM).length;
  const passingRate = totalCompleted > 0 ? Math.round((passedCount / totalCompleted) * 100) : 0;

  // Toggle single selection
  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedSessionIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Toggle select all
  const handleToggleSelectAll = () => {
    if (selectedSessionIds.length === rankedSessions.length) {
      setSelectedSessionIds([]);
    } else {
      setSelectedSessionIds(rankedSessions.map((s) => s.id));
    }
  };

  // Reset exam session (allows student to retake)
  const handleResetSessions = async (ids: string[]) => {
    if (ids.length === 0) return;
    const confirmMessage =
      ids.length === 1
        ? 'Apakah Anda yakin ingin me-reset ujian siswa ini? Hasil ujian akan dihapus agar siswa dapat login dan mengerjakan ulang dari awal.'
        : `Apakah Anda yakin ingin me-reset ${ids.length} hasil ujian siswa terpilih agar mereka dapat mengerjakan ulang?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      if (onResetSessions) {
        onResetSessions(ids);
      } else {
        await apiService.batchDeleteSessionsFromServer(ids);
        ids.forEach((id) => onDeleteSession?.(id));
      }
      setSelectedSessionIds([]);
      if (selectedSession && ids.includes(selectedSession.id)) {
        const remaining = rankedSessions.filter((s) => !ids.includes(s.id));
        setSelectedSession(remaining[0] || null);
      }
      alert('Berhasil di-reset! Siswa sekarang dapat mengerjakan kembali ujian.');
    } catch (err: any) {
      alert('Gagal me-reset: ' + (err?.message || 'Terjadi kesalahan'));
    }
  };

  // Batch delete
  const handleDeleteSessions = async (ids: string[]) => {
    if (ids.length === 0) return;
    const confirmMessage =
      ids.length === 1
        ? 'Hapus hasil ujian siswa ini secara permanen?'
        : `Hapus permanen ${ids.length} hasil ujian siswa terpilih?`;

    if (!window.confirm(confirmMessage)) return;

    try {
      await apiService.batchDeleteSessionsFromServer(ids);
      ids.forEach((id) => onDeleteSession?.(id));
      setSelectedSessionIds([]);
      if (selectedSession && ids.includes(selectedSession.id)) {
        const remaining = rankedSessions.filter((s) => !ids.includes(s.id));
        setSelectedSession(remaining[0] || null);
      }
    } catch (err: any) {
      alert('Gagal menghapus: ' + (err?.message || 'Terjadi kesalahan'));
    }
  };

  // Open Edit Modal
  const handleOpenEditModal = (session: StudentExamSession, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingSession(session);
    setEditScore(Math.round(session.percentage));
    setEditPassed(session.passedKKM);
    setEditNotes(session.remedialPlan?.summary || '');
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!editingSession) return;
    const newPercentage = Math.min(100, Math.max(0, Number(editScore)));
    const updated: StudentExamSession = {
      ...editingSession,
      percentage: newPercentage,
      passedKKM: editPassed,
      totalScore: Math.round((newPercentage / 100) * editingSession.maxTotalScore),
    };

    try {
      await apiService.updateSessionOnServer(updated.id, updated);
      onUpdateSession(updated);
      if (selectedSession?.id === updated.id) {
        setSelectedSession(updated);
      }
      setEditingSession(null);
      alert('Hasil ujian siswa berhasil diperbarui!');
    } catch (err: any) {
      alert('Gagal memperbarui: ' + (err?.message || 'Terjadi kesalahan'));
    }
  };

  // Generate Remedial or Enrichment with Gemini AI
  const handleGenerateRemedialEnrichment = async (session: StudentExamSession) => {
    setGeneratingAi(true);
    try {
      const weakTopics: string[] = [];
      const strongTopics: string[] = [];

      exam.questions.forEach((q) => {
        const ans = session.answers[q.id];
        if (ans && (ans.awardedScore || 0) < q.maxScore * 0.7) {
          weakTopics.push(q.concept || q.question.substring(0, 40));
        } else {
          strongTopics.push(q.concept || q.question.substring(0, 40));
        }
      });

      const plan = await apiService.generateRemedialEnrichment({
        studentName: session.studentName,
        subject: exam.subject,
        finalScore: Math.round(session.percentage),
        kkm: schoolProfile.defaultKkm || exam.kkm,
        weakTopics: weakTopics.slice(0, 3),
        strongTopics: strongTopics.slice(0, 3),
      });

      const updated = {
        ...session,
        remedialPlan: plan,
      };

      onUpdateSession(updated);
      setSelectedSession(updated);
    } catch (err: any) {
      alert(`Gagal membuat analisis AI: ${err.message || 'Periksa API Key Gemini'}`);
    } finally {
      setGeneratingAi(false);
    }
  };

  // WhatsApp sender builder
  const handleSendWhatsApp = (session: StudentExamSession) => {
    const student = students.find((s) => s.id === session.studentId || s.nisn === session.studentNisn);
    const rawPhone = student?.parentPhone || '081234567890';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '62' + cleanPhone.substring(1);
    }

    const statusText = session.passedKKM
      ? '✅ TUNTAS (Memenuhi KKM)'
      : '⚠️ BELUM TUNTAS (Perlu Program Remidi)';

    const remedialNotes = session.remedialPlan
      ? `\n📌 *Catatan Edukatif AI (${session.remedialPlan.type.toUpperCase()}):*\n${session.remedialPlan.summary}`
      : '';

    const text = encodeURIComponent(
      `Yth. Bapak/Ibu Orang Tua/Wali dari *${session.studentName}*,\n\n` +
      `Berikut kami sampaikan Laporan Hasil Asesmen Ujian Interaktif:\n` +
      `🏫 *Sekolah:* ${schoolProfile.name}\n` +
      `📚 *Mata Pelajaran:* ${exam.subject}\n` +
      `📅 *Tanggal:* ${session.finishTime ? new Date(session.finishTime).toLocaleDateString('id-ID') : 'Hari ini'}\n` +
      `🎯 *Nilai Akhir:* *${session.percentage.toFixed(1)} / 100* (KKM: ${schoolProfile.defaultKkm})\n` +
      `📊 *Status Kelulusan:* ${statusText}\n` +
      `🛡️ *Catatan Tertib Ujian:* ${session.tabSwitchCount === 0 ? 'Tertib tanpa meninggalkan tab' : `${session.tabSwitchCount} kali peringatan tab`}` +
      `${remedialNotes}\n\n` +
      `Terima kasih atas bimbingan dan kerja sama Bapak/Ibu di rumah.\n` +
      `_Salam hormat,_\n` +
      `*Guru Pengampu:* ${schoolProfile.teacherName}`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${text}`, '_blank');
  };

  // Email sender
  const handleSendEmail = (session: StudentExamSession) => {
    const student = students.find((s) => s.id === session.studentId || s.nisn === session.studentNisn);
    const email = student?.parentEmail || '';
    const subject = encodeURIComponent(`Hasil Ujian ${exam.subject} - ${session.studentName} - ${schoolProfile.name}`);
    const body = encodeURIComponent(
      `Yth. Bapak/Ibu Orang Tua dari ${session.studentName},\n\n` +
      `Nilai Akhir Ujian ${exam.subject}: ${session.percentage.toFixed(1)} / 100.\n` +
      `Status: ${session.passedKKM ? 'TUNTAS' : 'REMIDI'}.\n\n` +
      `Hormat kami,\n${schoolProfile.name}`
    );
    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Classical Summary */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
              Rekapitulasi Hasil Ujian EduCBT
            </span>
            <span className="text-xs text-slate-500">{exam.subject} • {exam.grade}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Menu Hasil Ujian: Pilih, Edit, Hapus &amp; Reset Ujian
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola hasil peserta, izinkan siswa mengerjakan ulang (reset), edit skor koreksi, dan cetak laporan hasil
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Cetak Klasikal Button */}
          <button
            id="btn-print-classical"
            onClick={() => onOpenPrintModal('classical')}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-slate-900 hover:bg-slate-800 text-white flex items-center gap-1.5 shadow-xs transition"
          >
            <Printer className="w-4 h-4 text-indigo-300" />
            <span>Cetak Hasil Klasikal (Leger)</span>
          </button>

          {/* Export Excel */}
          <button
            id="btn-export-results-excel"
            onClick={() => excelService.exportResultsToExcel(rankedSessions, exam.title)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 flex items-center gap-1.5 transition"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>Unduh Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Scoring Standards & Calculation Rule Banner */}
      <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/60 to-purple-50/80 p-4 rounded-2xl border border-indigo-200 text-xs text-slate-800 space-y-2">
        <div className="flex items-center gap-2 font-bold text-indigo-950">
          <Calculator className="w-4 h-4 text-indigo-600" />
          <span>Aturan Skoring Otomatis &amp; Pembobotan Nilai Akhir:</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100">
            <span className="font-bold text-blue-700 block">1. Pilihan Ganda</span>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Benar skor <strong>1</strong> • Salah skor <strong>0</strong>.
            </p>
          </div>
          <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100">
            <span className="font-bold text-emerald-700 block">2. Isian Jawaban Pendek</span>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Benar skor <strong>2</strong> • Salah skor <strong>1</strong> (Penilaian AI berdasarkan kata kunci, sinonim, &amp; kemiripan ide).
            </p>
          </div>
          <div className="bg-white/80 p-2.5 rounded-xl border border-indigo-100">
            <span className="font-bold text-purple-700 block">3. Uraian / Esai</span>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Benar skor <strong>3</strong> • Sebagian <strong>2</strong> • Salah <strong>1</strong> (Penilaian AI berbasis rubrik &amp; ide).
            </p>
          </div>
        </div>
        <div className="text-[11px] text-indigo-900 bg-white/60 p-2 rounded-lg font-medium flex items-center gap-1.5">
          <span>🎯</span>
          <span>
            <strong>Skor Akhir:</strong> Dihitung dari rerata skor yang didapat per jenis soal dan skor maksimal semua jenis soal, terkonversi skala 0 - 100.
          </span>
        </div>
      </div>

      {/* 2. Classical Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 block">Rata-Rata Kelas</span>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{averageScore.toFixed(1)}</p>
          <span className="text-[11px] text-slate-400">Skala 0 - 100</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-800 block">Nilai Tertinggi</span>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{highestScore.toFixed(1)}</p>
          <span className="text-[11px] text-emerald-600 font-medium">Prestasi Terbaik</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/40 shadow-2xs">
          <span className="text-xs font-semibold text-rose-800 block">Nilai Terendah</span>
          <p className="text-2xl font-bold text-rose-700 mt-1">{lowestScore.toFixed(1)}</p>
          <span className="text-[11px] text-rose-600 font-medium">Batas Remidi</span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-purple-200 bg-purple-50/40 shadow-2xs">
          <span className="text-xs font-semibold text-purple-800 block">Ketuntasan KKM ({schoolProfile.defaultKkm})</span>
          <p className="text-2xl font-bold text-purple-700 mt-1">{passingRate}%</p>
          <span className="text-[11px] text-purple-600 font-medium">{passedCount} dari {totalCompleted} Tuntas</span>
        </div>
      </div>

      {/* Multi-action Floating Bar when items are selected */}
      {selectedSessionIds.length > 0 && (
        <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg flex flex-wrap items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="font-bold px-2.5 py-1 bg-indigo-600 rounded-lg">
              {selectedSessionIds.length} Siswa Dipilih
            </span>
            <span className="text-slate-300">Pilih tindakan massal:</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Reset Selected */}
            <button
              onClick={() => handleResetSessions(selectedSessionIds)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 shadow-sm transition"
              title="Reset ujian agar siswa dapat mengerjakan ulang kembali"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Ujian ({selectedSessionIds.length})</span>
            </button>

            {/* Delete Selected */}
            <button
              onClick={() => handleDeleteSessions(selectedSessionIds)}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1.5 shadow-sm transition"
              title="Hapus permanen hasil ujian terpilih"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Hapus Hasil ({selectedSessionIds.length})</span>
            </button>

            {/* Clear Selection */}
            <button
              onClick={() => setSelectedSessionIds([])}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition"
              title="Batal Pilih"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Main Split View: Left Ranking / Students, Right Student Detail Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student Submissions List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="p-1 text-slate-600 hover:text-slate-900 rounded transition"
                title={selectedSessionIds.length === rankedSessions.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
              >
                {selectedSessionIds.length === rankedSessions.length && rankedSessions.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                ) : (
                  <Square className="w-4 h-4 text-slate-400" />
                )}
              </button>
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Daftar Peserta ({rankedSessions.length} Selesai)
              </h3>
            </div>
            <span className="text-[11px] text-slate-400">Pilih, edit, hapus, reset</span>
          </div>

          <div className="space-y-2">
            {rankedSessions.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                Belum ada siswa yang menyelesaikan ujian.
              </div>
            ) : (
              rankedSessions.map((s, idx) => {
                const isSelected = selectedSession?.id === s.id;
                const isChecked = selectedSessionIds.includes(s.id);
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSession(s)}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 shadow-xs ring-1 ring-blue-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* Checkbox for Pilih */}
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelect(s.id, e)}
                        className="p-1 text-slate-400 hover:text-indigo-600 shrink-0"
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-indigo-600" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-400" />
                        )}
                      </button>

                      <div
                        className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-800'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </div>

                      <div className="min-w-0">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                          {s.studentName}
                        </h4>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5 truncate">
                          <span>NISN: {s.studentNisn}</span>
                          <span>•</span>
                          <span>Kelas {s.classRoom}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <span className="text-base font-extrabold text-slate-900 block leading-tight">
                          {s.percentage.toFixed(1)}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                            s.passedKKM ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {s.passedKKM ? 'TUNTAS' : 'REMIDI'}
                        </span>
                      </div>

                      {/* Quick Action Drop/Buttons */}
                      <div className="flex items-center gap-1">
                        {/* Edit Button */}
                        <button
                          type="button"
                          onClick={(e) => handleOpenEditModal(s, e)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Edit nilai dan status siswa ini"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {/* Reset Button (ulang ujian) */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetSessions([s.id]);
                          }}
                          className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                          title="Reset ujian agar siswa dapat mengerjakan ulang"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete Button */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteSessions([s.id]);
                          }}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Hapus hasil ujian siswa ini"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Student Detailed Inspection & AI Remidi/Pengayaan */}
        <div className="lg:col-span-7 space-y-4">
          {selectedSession ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
              {/* Student Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-slate-900">{selectedSession.studentName}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        selectedSession.passedKKM
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {selectedSession.passedKKM ? 'TUNTAS' : 'REMIDI'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    NISN: <span className="font-mono">{selectedSession.studentNisn}</span> • Kelas: {selectedSession.classRoom} • Nilai: {selectedSession.percentage.toFixed(1)} / 100
                  </p>
                </div>

                {/* Quick actions for student */}
                <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                  {/* Edit Siswa Button */}
                  <button
                    id="btn-edit-selected-session"
                    onClick={() => handleOpenEditModal(selectedSession)}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center gap-1 transition"
                    title="Edit nilai dan status kelulusan"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit Nilai</span>
                  </button>

                  {/* Reset Siswa Button */}
                  <button
                    id="btn-reset-selected-session"
                    onClick={() => handleResetSessions([selectedSession.id])}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 transition"
                    title="Reset agar siswa dapat mengerjakan ulang ujian"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Reset Ujian</span>
                  </button>

                  {/* Cetak Hasil Individu */}
                  <button
                    id="btn-print-individual"
                    onClick={() => onOpenPrintModal('individual', selectedSession)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1 transition shadow-xs"
                    title="Cetak Lembar Hasil Ujian Individu Siswa"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak</span>
                  </button>

                  {/* Send to WA Orang Tua */}
                  <button
                    id="btn-wa-parent"
                    onClick={() => handleSendWhatsApp(selectedSession)}
                    className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition shadow-xs"
                    title="Kirim Hasil Ujian ke WhatsApp Orang Tua"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Kirim WA</span>
                  </button>

                  {/* Send Email Orang Tua */}
                  <button
                    id="btn-email-parent"
                    onClick={() => handleSendEmail(selectedSession)}
                    className="p-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
                    title="Kirim Hasil Ujian ke Email Orang Tua"
                  >
                    <Mail className="w-3.5 h-3.5 text-slate-600" />
                  </button>
                </div>
              </div>

              {/* Score by question type breakdown */}
              {selectedSession.typeScores && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 text-xs space-y-1">
                    <span className="font-bold text-blue-900 block">Pilihan Ganda</span>
                    <div className="text-base font-extrabold text-blue-700">
                      {selectedSession.typeScores.pilihan_ganda.earnedScore} / {selectedSession.typeScores.pilihan_ganda.maxScore} Poin
                    </div>
                    <span className="text-[10px] text-blue-600">
                      Rata-rata: {selectedSession.typeScores.pilihan_ganda.averagePercentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 text-xs space-y-1">
                    <span className="font-bold text-emerald-900 block">Isian Jawaban Pendek</span>
                    <div className="text-base font-extrabold text-emerald-700">
                      {selectedSession.typeScores.isian_singkat.earnedScore} / {selectedSession.typeScores.isian_singkat.maxScore} Poin
                    </div>
                    <span className="text-[10px] text-emerald-600">
                      Rata-rata: {selectedSession.typeScores.isian_singkat.averagePercentage.toFixed(1)}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/50 text-xs space-y-1">
                    <span className="font-bold text-purple-900 block">Uraian / Esai</span>
                    <div className="text-base font-extrabold text-purple-700">
                      {selectedSession.typeScores.uraian.earnedScore} / {selectedSession.typeScores.uraian.maxScore} Poin
                    </div>
                    <span className="text-[10px] text-purple-600">
                      Rata-rata: {selectedSession.typeScores.uraian.averagePercentage.toFixed(1)}%
                    </span>
                  </div>
                </div>
              )}

              {/* AI Remidi & Pengayaan Feature Box */}
              <div
                className={`p-5 rounded-2xl border transition ${
                  selectedSession.passedKKM
                    ? 'bg-gradient-to-br from-indigo-50/70 via-purple-50/50 to-white border-indigo-200'
                    : 'bg-gradient-to-br from-amber-50/70 via-rose-50/50 to-white border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles
                      className={`w-5 h-5 ${
                        selectedSession.passedKKM ? 'text-indigo-600' : 'text-amber-600'
                      }`}
                    />
                    <h4 className="font-bold text-slate-900 text-sm">
                      {selectedSession.passedKKM
                        ? 'Program Pengayaan Siswa (AI Gemini)'
                        : 'Program Remedial Terarah Siswa (AI Gemini)'}
                    </h4>
                  </div>

                  <button
                    onClick={() => handleGenerateRemedialEnrichment(selectedSession)}
                    disabled={generatingAi}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 flex items-center gap-1 transition disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3 h-3 ${generatingAi ? 'animate-spin' : ''}`} />
                    <span>{generatingAi ? 'Menyusun Analisis...' : 'Analisis Ulang AI'}</span>
                  </button>
                </div>

                {selectedSession.remedialPlan ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <h5 className="font-bold text-slate-800 text-xs">
                        {selectedSession.remedialPlan.headline}
                      </h5>
                      <p className="text-slate-600 leading-relaxed mt-1">
                        {selectedSession.remedialPlan.summary}
                      </p>
                    </div>

                    {/* Action Steps */}
                    <div className="bg-white/80 p-3 rounded-xl border border-slate-200 space-y-1.5">
                      <span className="font-bold text-slate-700 flex items-center gap-1.5">
                        <Target className="w-3.5 h-3.5 text-indigo-600" />
                        Rencana Aksi &amp; Langkah Belajar:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
                        {selectedSession.remedialPlan.actionSteps.map((step, sIdx) => (
                          <li key={sIdx} className="leading-snug">{step}</li>
                        ))}
                      </ul>
                    </div>

                    {/* Practice Questions */}
                    {selectedSession.remedialPlan.practiceQuestions.length > 0 && (
                      <div className="bg-white/80 p-3 rounded-xl border border-slate-200 space-y-1.5">
                        <span className="font-bold text-slate-700 flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                          Latihan Soal {selectedSession.passedKKM ? 'Pengayaan' : 'Remedial'}:
                        </span>
                        <div className="space-y-1.5 text-slate-700">
                          {selectedSession.remedialPlan.practiceQuestions.map((qText, qIdx) => (
                            <div key={qIdx} className="p-2 bg-slate-50 rounded-lg text-[11px] leading-relaxed">
                              {qIdx + 1}. {qText}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Motivation Quote */}
                    {selectedSession.remedialPlan.motivationQuote && (
                      <div className="italic text-slate-600 flex items-start gap-2 pt-1">
                        <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span>"{selectedSession.remedialPlan.motivationQuote}"</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-slate-500 space-y-2">
                    <p>Program remidi atau pengayaan otomatis belum digenerate untuk siswa ini.</p>
                    <button
                      onClick={() => handleGenerateRemedialEnrichment(selectedSession)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      Generate Analisis AI Sekarang
                    </button>
                  </div>
                )}
              </div>

              {/* Question By Question Scoring Breakdown */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">
                  Rincian Jawaban &amp; Penilaian Tiap Butir Soal
                </h4>

                <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {exam.questions.map((q, idx) => {
                    const ans = selectedSession.answers[q.id];
                    const awarded = ans?.awardedScore ?? 0;
                    const maxScore = q.maxScore;
                    const isPerfect = awarded === maxScore;

                    return (
                      <div
                        key={q.id}
                        className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-2 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800">
                            Soal #{idx + 1} ({q.type.replace(/_/g, ' ')})
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                              isPerfect
                                ? 'bg-emerald-100 text-emerald-800'
                                : awarded > 0
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            Skor: {awarded} / {maxScore} Poin
                          </span>
                        </div>

                        <p className="text-slate-800 font-medium">{q.question}</p>

                        {/* Student answer */}
                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 space-y-1">
                          <div className="text-[11px] text-slate-400 font-semibold">Jawaban Siswa:</div>
                          <div className="font-semibold text-indigo-950">
                            {ans?.answer
                              ? Array.isArray(ans.answer)
                                ? ans.answer.join(', ')
                                : ans.answer
                              : '(Tidak Dijawab)'}
                          </div>
                          {ans?.matchedKeywords && ans.matchedKeywords.length > 0 && (
                            <div className="text-[11px] text-emerald-700">
                              Kata Kunci Teridentifikasi: <strong>{ans.matchedKeywords.join(', ')}</strong>
                            </div>
                          )}
                          {ans?.feedback && (
                            <div className="text-[11px] text-slate-500 italic pt-1 border-t border-slate-100">
                              Feedback AI: {ans.feedback}
                            </div>
                          )}
                        </div>

                        {/* Correct reference */}
                        <div className="text-[11px] text-slate-500 flex items-center justify-between">
                          <span>
                            Kunci Acuan:{' '}
                            <strong className="text-slate-700">
                              {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                            </strong>
                          </span>
                          {q.concept && (
                            <span className="truncate max-w-xs text-slate-400">
                              Konsep: {q.concept}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400 text-xs">
              Pilih siswa dari daftar di sebelah kiri untuk melihat rincian asesmen.
            </div>
          )}
        </div>
      </div>

      {/* Edit Session Modal */}
      {editingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-sm text-slate-900">Edit Nilai Asesmen Siswa</h3>
              </div>
              <button
                onClick={() => setEditingSession(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-slate-500 block">Nama Peserta:</span>
                <span className="font-bold text-slate-900 text-sm">{editingSession.studentName}</span>
                <span className="text-slate-400 block">NISN: {editingSession.studentNisn} • Kelas {editingSession.classRoom}</span>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nilai Akhir (Skala 0 - 100)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={editScore}
                  onChange={(e) => setEditScore(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-sm font-bold text-indigo-700 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Status Kelulusan KKM ({schoolProfile.defaultKkm})
                </label>
                <select
                  value={editPassed ? 'true' : 'false'}
                  onChange={(e) => setEditPassed(e.target.value === 'true')}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="true">✅ TUNTAS (Memenuhi KKM)</option>
                  <option value="false">⚠️ BELUM TUNTAS (Perlu Remidi)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Guru (Opsional)
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Catatan koreksi atau evaluasi khusus guru..."
                  className="w-full p-2.5 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingSession(null)}
                className="px-3 py-2 text-xs font-semibold rounded-xl text-slate-600 hover:bg-slate-100"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5 shadow-sm"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Simpan Perubahan</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
