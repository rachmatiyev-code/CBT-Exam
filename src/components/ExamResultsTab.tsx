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
  onOpenPrintModal: (type: 'individual' | 'classical', session?: StudentExamSession) => void;
}

export const ExamResultsTab: React.FC<ExamResultsTabProps> = ({
  exam,
  schoolProfile,
  students,
  sessions,
  onUpdateSession,
  onOpenPrintModal,
}) => {
  const [selectedSession, setSelectedSession] = useState<StudentExamSession | null>(
    sessions.find((s) => s.status === 'selesai') || sessions[0] || null
  );
  const [generatingAi, setGeneratingAi] = useState(false);

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

  // Generate Remedial or Enrichment with Gemini AI
  const handleGenerateRemedialEnrichment = async (session: StudentExamSession) => {
    setGeneratingAi(true);
    try {
      // Find weak questions where score < maxScore
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
              Rekapitulasi Asesmen
            </span>
            <span className="text-xs text-slate-500">{exam.subject} • {exam.grade}</span>
          </div>
          <h2 className="text-lg sm:text-xl font-bold text-slate-900">
            Hasil Ujian, Skoring AI, Remidi &amp; Pengayaan
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Cetak lembar nilai individu siswa, leger nilai klasikal, serta kirim ke WhatsApp / Email orang tua
          </p>
        </div>

        {/* Print Buttons */}
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

      {/* 3. Main Split View: Left Ranking / Students, Right Student Detail Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Student Submissions List */}
        <div className="lg:col-span-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Daftar Peserta Ujian ({rankedSessions.length} Selesai)
            </h3>
            <span className="text-[11px] text-slate-400">Klik untuk melihat detail</span>
          </div>

          <div className="space-y-2">
            {rankedSessions.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">
                Belum ada siswa yang menyelesaikan ujian.
              </div>
            ) : (
              rankedSessions.map((s, idx) => {
                const isSelected = selectedSession?.id === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedSession(s)}
                    className={`p-4 rounded-2xl border cursor-pointer transition flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-50/80 border-blue-500 shadow-xs ring-1 ring-blue-500'
                        : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                          idx === 0
                            ? 'bg-amber-100 text-amber-800'
                            : idx === 1
                            ? 'bg-slate-200 text-slate-800'
                            : idx === 2
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        #{idx + 1}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm leading-snug">
                          {s.studentName}
                        </h4>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2">
                          <span>NISN: {s.studentNisn}</span>
                          <span>•</span>
                          <span>Kelas {s.classRoom}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base font-extrabold text-slate-900 block">
                        {s.percentage.toFixed(1)}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          s.passedKKM ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {s.passedKKM ? 'TUNTAS' : 'REMIDI'}
                      </span>
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
                    NISN: <span className="font-mono">{selectedSession.studentNisn}</span> • Kelas: {selectedSession.classRoom} • Skor: {selectedSession.totalScore} / {selectedSession.maxTotalScore} ({selectedSession.percentage.toFixed(1)}%)
                  </p>
                </div>

                {/* Quick actions for student */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Cetak Hasil Individu (Sesuai Permintaan) */}
                  <button
                    id="btn-print-individual"
                    onClick={() => onOpenPrintModal('individual', selectedSession)}
                    className="px-3.5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 transition shadow-xs"
                    title="Cetak Lembar Hasil Ujian Individu Siswa"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Cetak Individu</span>
                  </button>

                  {/* Send to WA Orang Tua (Sesuai Permintaan) */}
                  <button
                    id="btn-wa-parent"
                    onClick={() => handleSendWhatsApp(selectedSession)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1.5 transition shadow-xs"
                    title="Kirim Hasil Ujian ke WhatsApp Orang Tua"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Kirim WA</span>
                  </button>

                  {/* Send Email Orang Tua (Sesuai Permintaan) */}
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

              {/* AI Remidi & Pengayaan Feature Box (Sesuai Permintaan) */}
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
    </div>
  );
};
