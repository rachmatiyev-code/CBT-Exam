import React, { useState } from 'react';
import {
  Sparkles,
  Plus,
  FileSpreadsheet,
  Download,
  Upload,
  Trash2,
  Edit,
  Copy,
  BookOpen,
  CheckCircle,
  FileText,
  HelpCircle,
  Clock,
  KeyRound,
  Layers,
  History,
  BookmarkPlus,
  Printer,
  Check,
  Search,
  Share2,
  ExternalLink,
  X,
  AlertCircle,
  RefreshCw,
  FolderArchive,
  ArrowRight,
} from 'lucide-react';
import { Exam, Question, QuestionType, ExamPackage } from '../types';
import { excelService } from '../services/gasSync';
import { apiService } from '../services/api';

interface QuestionBankTabProps {
  exam: Exam;
  packages?: ExamPackage[];
  onUpdateExam: (updated: Exam) => void;
  onSaveToHistory?: (pkg: ExamPackage) => void;
  onLoadPackage?: (pkg: ExamPackage) => void;
  onDeletePackage?: (packageId: string) => void;
  onOpenAiGenerator: () => void;
  onOpenPrintQuestions?: () => void;
  onOpenPrintKisiKisi?: () => void;
  onTriggerBackup: () => void;
}

export const QuestionBankTab: React.FC<QuestionBankTabProps> = ({
  exam,
  packages = [],
  onUpdateExam,
  onSaveToHistory,
  onLoadPackage,
  onDeletePackage,
  onOpenAiGenerator,
  onOpenPrintQuestions,
  onOpenPrintKisiKisi,
  onTriggerBackup,
}) => {
  const [filterType, setFilterType] = useState<string>('all');
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);

  // History & Save Package Modals
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [copiedNotification, setCopiedNotification] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [saveFormData, setSaveFormData] = useState({
    code: exam.code || 'SOAL-01',
    token: exam.token || 'EXAM26',
    title: exam.title || '',
    note: '',
  });

  const handleCopyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedNotification(label);
    setTimeout(() => setCopiedNotification(null), 2500);
  };

  // Filtered questions
  const filteredQuestions = exam.questions.filter((q) => {
    if (filterType === 'all') return true;
    return q.type === filterType;
  });

  const handleDelete = (id: string) => {
    if (confirm('Yakin ingin menghapus butir soal ini?')) {
      const updatedQuestions = exam.questions.filter((q) => q.id !== id);
      onUpdateExam({ ...exam, questions: updatedQuestions });
      onTriggerBackup();
    }
  };

  const handleDuplicate = (q: Question) => {
    const duplicated: Question = {
      ...q,
      id: `q-dup-${Date.now()}`,
      question: `${q.question} (Salinan)`,
    };
    onUpdateExam({ ...exam, questions: [...exam.questions, duplicated] });
    onTriggerBackup();
  };

  const handleSaveQuestion = (q: Question) => {
    let updatedQuestions: Question[];
    const exists = exam.questions.some((item) => item.id === q.id);
    if (exists) {
      updatedQuestions = exam.questions.map((item) => (item.id === q.id ? q : item));
    } else {
      updatedQuestions = [...exam.questions, q];
    }
    onUpdateExam({ ...exam, questions: updatedQuestions });
    setIsModalOpen(false);
    setEditingQuestion(null);
    onTriggerBackup();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const imported = await excelService.parseQuestionsFromExcel(file);
      if (imported.length === 0) {
        alert('File tidak berisi format soal yang dikenali.');
        return;
      }
      onUpdateExam({
        ...exam,
        questions: [...exam.questions, ...imported],
      });
      onTriggerBackup();
      alert(`Berhasil mengimpor ${imported.length} butir soal ke Bank Soal!`);
    } catch (err: any) {
      alert(`Gagal mengimpor file: ${err.message || 'Format tidak valid'}`);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  const handleOpenSaveModal = () => {
    setSaveFormData({
      code: exam.code || `SOAL-${Math.floor(Math.random() * 900 + 100)}`,
      token: exam.token || `TOK${Math.floor(Math.random() * 90 + 10)}`,
      title: exam.title || '',
      note: `Tersimpan pada ${new Date().toLocaleDateString('id-ID')}`,
    });
    setIsSaveModalOpen(true);
  };

  const handleConfirmSavePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveFormData.code.trim() || !saveFormData.token.trim() || !saveFormData.title.trim()) {
      alert('Kode Soal, Token, dan Judul Paket wajib diisi.');
      return;
    }

    const newPackage: ExamPackage = {
      id: `pkg-${Date.now()}`,
      code: saveFormData.code.toUpperCase().trim(),
      token: saveFormData.token.toUpperCase().trim(),
      title: saveFormData.title.trim(),
      subject: exam.subject,
      grade: exam.grade,
      semester: exam.semester,
      durationMinutes: exam.durationMinutes,
      kkm: exam.kkm,
      educationGoal: exam.educationGoal,
      coreMaterial: exam.coreMaterial,
      questionsCount: exam.questions.length,
      questions: JSON.parse(JSON.stringify(exam.questions)),
      savedAt: new Date().toISOString(),
      note: saveFormData.note.trim(),
    };

    // Update current exam code & token if changed
    if (exam.code !== newPackage.code || exam.token !== newPackage.token || exam.title !== newPackage.title) {
      onUpdateExam({
        ...exam,
        code: newPackage.code,
        token: newPackage.token,
        title: newPackage.title,
      });
    }

    if (onSaveToHistory) {
      onSaveToHistory(newPackage);
    }
    setIsSaveModalOpen(false);
    handleCopyText(`Kode: ${newPackage.code} | Token: ${newPackage.token}`, 'Paket Soal Disimpan!');
  };

  const totalMaxScore = exam.questions.reduce((acc, q) => acc + (q.maxScore || 10), 0);

  // Filter history packages
  const filteredPackages = packages.filter((p) => {
    const q = historySearch.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.token.toLowerCase().includes(q) ||
      p.subject.toLowerCase().includes(q) ||
      p.grade.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {copiedNotification && (
        <div className="fixed top-5 right-5 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 border border-slate-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>{copiedNotification}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs flex flex-col lg:flex-row items-start lg:items-center justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              {exam.subject}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
              {exam.grade} • Semester {exam.semester}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              Kode: {exam.code || 'IPA-09-01'}
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <KeyRound className="w-3 h-3 text-emerald-600" />
              Token: {exam.token}
            </span>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-900">{exam.title}</h2>
          <p className="text-xs text-slate-500 line-clamp-2">
            {exam.educationGoal ||
              'Tujuan Pembelajaran: Mengembangkan kompetensi penalaran dan pemahaman konsep komprehensif.'}
          </p>

          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <button
              onClick={() => handleCopyText(exam.token, 'Token Siswa Disalin!')}
              className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold flex items-center gap-1.5 transition"
              title="Salin Token Siswa"
            >
              <Copy className="w-3.5 h-3.5 text-slate-500" />
              <span>Salin Token ({exam.token})</span>
            </button>

            <button
              onClick={() =>
                handleCopyText(
                  `${window.location.origin}${window.location.pathname}?mode=siswa&token=${exam.token}`,
                  'Tautan Langsung Siswa Disalin!'
                )
              }
              className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold flex items-center gap-1.5 transition"
              title="Salin Tautan Pengerjaan Siswa"
            >
              <Share2 className="w-3.5 h-3.5 text-blue-600" />
              <span>Salin Tautan Pengerjaan Siswa</span>
            </button>
          </div>
        </div>

        {/* Quick Stats & Package Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="flex items-center justify-around sm:justify-start gap-4 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200 shrink-0">
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Total Soal
              </span>
              <span className="text-base font-bold text-blue-600">{exam.questions.length} Butir</span>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Durasi
              </span>
              <span className="text-base font-bold text-slate-800">{exam.durationMinutes} Menit</span>
            </div>
            <div className="h-8 w-px bg-slate-200"></div>
            <div className="text-center">
              <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">
                Total Poin
              </span>
              <span className="text-base font-bold text-emerald-700">{totalMaxScore} Poin</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Format Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {[
            { id: 'all', label: `Semua (${exam.questions.length})` },
            {
              id: 'pilihan_ganda',
              label: `Pilihan Ganda (${exam.questions.filter((q) => q.type === 'pilihan_ganda').length})`,
            },
            {
              id: 'pilihan_ganda_kompleks',
              label: `PG Kompleks (${exam.questions.filter((q) => q.type === 'pilihan_ganda_kompleks').length})`,
            },
            {
              id: 'isian_singkat',
              label: `Isian Singkat (${exam.questions.filter((q) => q.type === 'isian_singkat').length})`,
            },
            {
              id: 'uraian',
              label: `Uraian / Esai (${exam.questions.filter((q) => q.type === 'uraian').length})`,
            },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setFilterType(item.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition text-xs ${
                filterType === item.id
                  ? 'bg-blue-600 text-white shadow-xs font-semibold'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Riwayat & Bank Paket Soal Button */}
          <button
            id="btn-open-package-history"
            onClick={() => setIsHistoryModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 flex items-center gap-1.5 transition shadow-2xs"
            title="Buka Menu Riwayat Paket Soal yang Dapat Dimuat Kembali"
          >
            <History className="w-4 h-4 text-purple-600" />
            <span>Riwayat Paket Soal</span>
            <span className="px-1.5 py-0.2 bg-purple-200 text-purple-800 text-[10px] rounded-full font-bold">
              {packages.length}
            </span>
          </button>

          {/* Simpan ke Riwayat */}
          <button
            id="btn-save-current-package"
            onClick={handleOpenSaveModal}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 flex items-center gap-1.5 transition shadow-2xs"
            title="Simpan Naskah & Token Terkini ke Riwayat Paket Soal"
          >
            <BookmarkPlus className="w-4 h-4 text-emerald-600" />
            <span>Simpan ke Riwayat</span>
          </button>

          {/* Cetak Naskah Soal */}
          {onOpenPrintQuestions && (
            <button
              id="btn-print-questions-toolbar"
              onClick={onOpenPrintQuestions}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 flex items-center gap-1.5 transition shadow-2xs"
              title="Cetak Naskah Butir Soal Ujian (PDF / Print)"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>Cetak Soal</span>
            </button>
          )}

          {/* Cetak Kisi-Kisi */}
          {onOpenPrintKisiKisi && (
            <button
              id="btn-print-kisi-kisi-toolbar"
              onClick={onOpenPrintKisiKisi}
              className="px-3 py-2 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 flex items-center gap-1.5 transition shadow-2xs"
              title="Cetak Format Kisi-Kisi Soal Asesmen (PDF / Print)"
            >
              <FileText className="w-4 h-4 text-indigo-600" />
              <span>Cetak Kisi-Kisi</span>
            </button>
          )}

          {/* Simpan ke Arsip EduCBT */}
          <button
            id="btn-archive-educbt"
            onClick={async () => {
              try {
                excelService.downloadExamArchive(exam, 'both');
                await apiService.archiveToEduCBT(exam);
                setCopiedNotification('Naskah dan Kisi-Kisi berhasil diarsipkan ke EduCBT/Riwayat Soal!');
                setTimeout(() => setCopiedNotification(null), 3500);
              } catch (e: any) {
                alert('Gagal mengarsipkan: ' + (e?.message || 'Error'));
              }
            }}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 flex items-center gap-1.5 transition shadow-2xs"
            title="Arsipkan Naskah ke Folder EduCBT/Riwayat Soal (.json & .txt)"
          >
            <FolderArchive className="w-4 h-4 text-amber-700" />
            <span>Arsip EduCBT</span>
          </button>

          {/* AI Generator Button */}
          <button
            id="btn-open-ai-generator"
            onClick={onOpenAiGenerator}
            className="px-3.5 py-2 text-xs font-bold rounded-xl bg-slate-900 hover:bg-slate-800 text-white shadow-sm flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-4 h-4 text-blue-400" />
            <span>Buat Soal AI Gemini</span>
          </button>

          {/* Add Manual Question */}
          <button
            id="btn-add-manual-question"
            onClick={() => {
              setEditingQuestion({
                id: `q-${Date.now()}`,
                type: 'pilihan_ganda',
                question: '',
                options: ['A. Pilihan satu', 'B. Pilihan dua', 'C. Pilihan tiga', 'D. Pilihan empat'],
                correctAnswer: 'A',
                maxScore: 1,
                explanation: '',
              });
              setIsModalOpen(true);
            }}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 flex items-center gap-1.5 transition shadow-2xs"
          >
            <Plus className="w-4 h-4 text-blue-600" />
            <span>Tambah Manual</span>
          </button>

          {/* Import Excel */}
          <label className="px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 flex items-center gap-1.5 transition cursor-pointer shadow-2xs">
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>{importing ? 'Mengimpor...' : 'Impor Excel'}</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>

          {/* Export Excel */}
          <button
            id="btn-export-questions"
            onClick={() => excelService.exportQuestionsToExcel(exam)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 flex items-center gap-1.5 transition shadow-2xs"
            title="Ekspor Bank Soal ke Format Excel / Spreadsheet"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Ekspor</span>
          </button>
        </div>
      </div>

      {/* Questions List */}
      <div className="space-y-4">
        {filteredQuestions.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8 space-y-3">
            <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">Tidak ada butir soal dalam kategori ini</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Gunakan generator AI untuk membuat soal otomatis atau tambah butir soal baru secara manual.
            </p>
            <button
              onClick={onOpenAiGenerator}
              className="mt-2 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white hover:bg-indigo-700"
            >
              Generate Soal AI Sekarang
            </button>
          </div>
        ) : (
          filteredQuestions.map((q, idx) => {
            const typeLabels: Record<QuestionType, { label: string; color: string }> = {
              pilihan_ganda: { label: 'Pilihan Ganda', color: 'bg-blue-50 text-blue-700 border-blue-200' },
              pilihan_ganda_kompleks: { label: 'PG Kompleks', color: 'bg-purple-50 text-purple-700 border-purple-200' },
              isian_singkat: { label: 'Isian Jawaban Pendek', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
              uraian: { label: 'Uraian / Esai', color: 'bg-amber-50 text-amber-700 border-amber-200' },
            };
            const typeConfig = typeLabels[q.type] || { label: q.type, color: 'bg-slate-100 text-slate-700' };

            return (
              <div
                key={q.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-xs transition space-y-3"
              >
                {/* Header row */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-800 font-bold text-xs flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${typeConfig.color}`}>
                      {typeConfig.label}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      Bobot: <strong>{q.maxScore} Poin</strong>
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleDuplicate(q)}
                      className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
                      title="Duplikasi Butir Soal"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingQuestion(q);
                        setIsModalOpen(true);
                      }}
                      className="p-1.5 text-indigo-600 hover:text-indigo-800 rounded-lg hover:bg-indigo-50 transition"
                      title="Edit Butir Soal"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(q.id)}
                      className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 transition"
                      title="Hapus Butir Soal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text */}
                <p className="text-slate-900 text-xs sm:text-sm font-medium leading-relaxed">
                  {q.question}
                </p>

                {/* Question Image if present */}
                {q.image && (
                  <div className="my-2">
                    <img
                      src={q.image}
                      alt="Gambar Soal"
                      className="max-h-48 max-w-full sm:max-w-md rounded-xl border border-slate-200 object-contain bg-slate-50 p-1 shadow-2xs"
                    />
                  </div>
                )}

                {/* Options (For PG & PG Kompleks) */}
                {q.options && q.options.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 pl-2">
                    {q.options.map((opt, oIdx) => {
                      const optLetter = opt.charAt(0).toUpperCase();
                      const isCorrect = Array.isArray(q.correctAnswer)
                        ? q.correctAnswer.includes(optLetter)
                        : q.correctAnswer === optLetter;

                      return (
                        <div
                          key={oIdx}
                          className={`text-xs p-2 rounded-xl border flex items-start gap-2 ${
                            isCorrect
                              ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950 font-medium'
                              : 'bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                        >
                          <span
                            className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] shrink-0 font-bold ${
                              isCorrect ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                            }`}
                          >
                            {optLetter}
                          </span>
                          <span className="leading-snug">{opt.substring(2).trim() || opt}</span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Metadata badges (Keywords, Rubric, Concept) */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-[11px]">
                  <div className="bg-slate-100 text-slate-800 px-2.5 py-1 rounded-lg">
                    <strong>Kunci:</strong>{' '}
                    <span className="text-emerald-700 font-bold">
                      {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                    </span>
                  </div>

                  {q.keywords && q.keywords.length > 0 && (
                    <div className="bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-1 rounded-lg">
                      <strong>Kata Kunci Penilaian AI:</strong> {q.keywords.join(', ')}
                    </div>
                  )}

                  {q.concept && (
                    <div className="bg-violet-50 text-violet-800 border border-violet-200 px-2.5 py-1 rounded-lg">
                      <strong>Konsep:</strong> {q.concept}
                    </div>
                  )}

                  {q.rubric && (
                    <div className="bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-1 rounded-lg">
                      <strong>Rubrik:</strong> {q.rubric}
                    </div>
                  )}
                </div>

                {q.explanation && (
                  <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">
                    <span className="font-semibold text-slate-700">Pembahasan:</span> {q.explanation}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Manual Add / Edit Question Modal */}
      {isModalOpen && editingQuestion && (
        <QuestionEditorModal
          question={editingQuestion}
          onSave={handleSaveQuestion}
          onClose={() => {
            setIsModalOpen(false);
            setEditingQuestion(null);
          }}
        />
      )}

      {/* Package History Modal */}
      {isHistoryModalOpen && (
        <ExamHistoryModal
          currentExam={exam}
          packages={packages}
          onLoad={(pkg) => {
            if (onLoadPackage) onLoadPackage(pkg);
            setIsHistoryModalOpen(false);
          }}
          onDelete={(id) => {
            if (onDeletePackage) onDeletePackage(id);
          }}
          onOpenSaveModal={() => {
            setIsHistoryModalOpen(false);
            handleOpenSaveModal();
          }}
          onCopyText={handleCopyText}
          onClose={() => setIsHistoryModalOpen(false)}
        />
      )}

      {/* Save Package Modal */}
      {isSaveModalOpen && (
        <SavePackageModal
          exam={exam}
          totalScore={totalMaxScore}
          formData={saveFormData}
          onChangeForm={setSaveFormData}
          onSubmit={handleConfirmSavePackage}
          onClose={() => setIsSaveModalOpen(false)}
        />
      )}
    </div>
  );
};

// Sub-component for editing question manually
interface QuestionEditorModalProps {
  question: Question;
  onSave: (q: Question) => void;
  onClose: () => void;
}

const QuestionEditorModal: React.FC<QuestionEditorModalProps> = ({ question, onSave, onClose }) => {
  const [formData, setFormData] = useState<Question>({ ...question });
  const [optionsStr, setOptionsStr] = useState(formData.options.join('\n'));
  const [correctAnswerStr, setCorrectAnswerStr] = useState(
    Array.isArray(formData.correctAnswer) ? formData.correctAnswer.join(', ') : formData.correctAnswer
  );
  const [keywordsStr, setKeywordsStr] = useState((formData.keywords || []).join(', '));

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const options =
      formData.type === 'pilihan_ganda' || formData.type === 'pilihan_ganda_kompleks'
        ? optionsStr.split('\n').map((s) => s.trim()).filter(Boolean)
        : [];

    let correctAnswer: any = correctAnswerStr.trim();
    if (formData.type === 'pilihan_ganda_kompleks') {
      correctAnswer = correctAnswerStr.split(/[,;\s]+/).map((s) => s.trim().toUpperCase()).filter(Boolean);
    }

    const keywords = keywordsStr.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);

    onSave({
      ...formData,
      options,
      correctAnswer,
      keywords,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between">
          <h3 className="text-sm font-bold">
            {question.question ? 'Edit Butir Soal' : 'Tambah Butir Soal Baru'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
          {/* Format selection */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { id: 'pilihan_ganda', label: 'Pilihan Ganda (1 Poin)', defaultScore: 1 },
              { id: 'pilihan_ganda_kompleks', label: 'PG Kompleks (1 Poin)', defaultScore: 1 },
              { id: 'isian_singkat', label: 'Isian Singkat (2 Poin)', defaultScore: 2 },
              { id: 'uraian', label: 'Uraian / Esai (3 Poin)', defaultScore: 3 },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setFormData({
                    ...formData,
                    type: t.id as QuestionType,
                    maxScore: t.defaultScore,
                  })
                }
                className={`p-2 rounded-xl border text-center font-semibold transition ${
                  formData.type === t.id
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Question Text */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Pertanyaan Soal</label>
            <textarea
              rows={3}
              required
              value={formData.question}
              onChange={(e) => setFormData({ ...formData, question: e.target.value })}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              placeholder="Tuliskan butir soal lengkap di sini..."
            />
          </div>

          {/* Unggah Gambar Soal (Image Upload) */}
          <div className="space-y-1.5">
            <label className="block font-semibold text-slate-700">
              Unggah Gambar / Ilustrasi Soal (Opsional)
            </label>
            {formData.image ? (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img
                    src={formData.image}
                    alt="Preview Gambar Soal"
                    className="w-16 h-16 object-contain rounded-lg border border-slate-300 bg-white p-1"
                  />
                  <div>
                    <p className="font-bold text-xs text-slate-800">Gambar Soal Terlampir</p>
                    <p className="text-[11px] text-slate-500">
                      Gambar akan otomatis ditampilkan pada kartu soal, pengerjaan siswa, dan cetak naskah.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, image: undefined })}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg border border-rose-200 flex items-center gap-1 transition shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Hapus
                </button>
              </div>
            ) : (
              <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:bg-slate-50/70 transition">
                <input
                  type="file"
                  id="upload-question-image-input"
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        alert('Ukuran gambar maksimal 5MB');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFormData({ ...formData, image: reader.result as string });
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  className="hidden"
                />
                <label
                  htmlFor="upload-question-image-input"
                  className="cursor-pointer flex flex-col items-center gap-1.5"
                >
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <Upload className="w-4 h-4" />
                  </div>
                  <span className="font-semibold text-slate-700 text-xs">
                    Klik untuk Unggah Gambar Soal (PNG, JPG, WEBP)
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Maksimal 5MB. Gambar akan tersimpan aman bersama naskah soal.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Options (Only if PG or PG Kompleks) */}
          {(formData.type === 'pilihan_ganda' || formData.type === 'pilihan_ganda_kompleks') && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Pilihan Jawaban (Satu baris per pilihan)
              </label>
              <textarea
                rows={4}
                value={optionsStr}
                onChange={(e) => setOptionsStr(e.target.value)}
                className="w-full text-xs p-3 font-mono rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                placeholder="A. Pilihan satu&#10;B. Pilihan dua&#10;C. Pilihan tiga&#10;D. Pilihan empat"
              />
            </div>
          )}

          {/* Correct Answer & Score */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kunci Jawaban{' '}
                <span className="text-slate-400 font-normal">
                  {formData.type === 'pilihan_ganda_kompleks' ? '(Contoh: A, C, D)' : '(Huruf / teks jawaban)'}
                </span>
              </label>
              <input
                type="text"
                required
                value={correctAnswerStr}
                onChange={(e) => setCorrectAnswerStr(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Bobot Skor Maksimal{' '}
                <span className="text-slate-400 font-normal">
                  (Standar: PG=1, Isian=2, Uraian=3)
                </span>
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={formData.maxScore}
                onChange={(e) => setFormData({ ...formData, maxScore: Number(e.target.value) })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Kisi-Kisi Metadata: Level Kognitif & Indikator Soal */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Level Kognitif</label>
              <select
                value={formData.cognitiveLevel || 'L2'}
                onChange={(e) => setFormData({ ...formData, cognitiveLevel: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="L1">L1: Pemahaman / Mengingat</option>
                <option value="L2">L2: Aplikasi / Penerapan</option>
                <option value="L3 (HOTS)">L3: Penalaran / HOTS</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">Indikator Soal (Untuk Kisi-Kisi)</label>
              <input
                type="text"
                value={formData.indicator || ''}
                onChange={(e) => setFormData({ ...formData, indicator: e.target.value })}
                placeholder="Disajikan teks/gambar, siswa mampu menganalisis..."
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Keywords & Concept (for isian and uraian) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kata Kunci Penilaian AI (Pisahkan dengan koma)
              </label>
              <input
                type="text"
                value={keywordsStr}
                onChange={(e) => setKeywordsStr(e.target.value)}
                placeholder="air, klorofil, glukosa, fotosintesis"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Konsep Materi Pokok</label>
              <input
                type="text"
                value={formData.concept || ''}
                onChange={(e) => setFormData({ ...formData, concept: e.target.value })}
                placeholder="Konsep metabolisme sel"
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Rubric for Uraian */}
          {formData.type === 'uraian' && (
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Rubrik Penilaian Skoring AI
              </label>
              <textarea
                rows={2}
                value={formData.rubric || ''}
                onChange={(e) => setFormData({ ...formData, rubric: e.target.value })}
                className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                placeholder="Skor 20 jika menyebutkan seluruh bahan dan hasil. Skor 10 jika menyebutkan sebagian..."
              />
            </div>
          )}

          {/* Explanation */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Pembahasan Soal</label>
            <textarea
              rows={2}
              value={formData.explanation || ''}
              onChange={(e) => setFormData({ ...formData, explanation: e.target.value })}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
              placeholder="Penjelasan edukatif untuk siswa saat pembahasan..."
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
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
              Simpan Soal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 2. EXAM HISTORY & PACKAGE MANAGER MODAL                                   */
/* ========================================================================= */
interface ExamHistoryModalProps {
  currentExam: Exam;
  packages: ExamPackage[];
  onLoad: (pkg: ExamPackage) => void;
  onDelete: (id: string) => void;
  onOpenSaveModal: () => void;
  onCopyText: (text: string, label: string) => void;
  onClose: () => void;
}

const ExamHistoryModal: React.FC<ExamHistoryModalProps> = ({
  currentExam,
  packages,
  onLoad,
  onDelete,
  onOpenSaveModal,
  onCopyText,
  onClose,
}) => {
  const [search, setSearch] = useState('');

  const filtered = packages.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.token.toLowerCase().includes(q) ||
      p.subject.toLowerCase().includes(q) ||
      p.grade.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-base">Riwayat & Bank Paket Soal</h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800">
                  {packages.length} Paket Tersimpan
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Muat kembali paket soal beserta Kode Soal & Token Siswa ke lembar ujian aktif kapan saja.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenSaveModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>Simpan Paket Aktif</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-slate-200 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari berdasarkan judul naskah, kode soal, token, mapel, atau kelas..."
              className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-slate-50/50"
            />
          </div>
        </div>

        {/* List of Packages */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50/40">
          {filtered.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-slate-300 p-8 space-y-3">
              <FolderArchive className="w-12 h-12 text-slate-300 mx-auto" />
              <h4 className="font-bold text-slate-800 text-sm">Tidak ada paket soal yang cocok</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {packages.length === 0
                  ? 'Belum ada riwayat paket soal. Klik tombol "Simpan Paket Aktif" untuk menyimpan paket soal saat ini.'
                  : 'Coba kata kunci pencarian yang lain.'}
              </p>
            </div>
          ) : (
            filtered.map((pkg) => {
              const isActive =
                (pkg.code && pkg.code === currentExam.code) ||
                (pkg.token && pkg.token === currentExam.token);

              return (
                <div
                  key={pkg.id}
                  className={`bg-white rounded-2xl p-5 border transition-all ${
                    isActive
                      ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    {/* Package Info */}
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          {pkg.subject}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {pkg.grade} • Semester {pkg.semester}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                          Kode: {pkg.code}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                          <KeyRound className="w-3 h-3 text-emerald-600" />
                          Token: {pkg.token}
                        </span>
                        {isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                            ✓ Sedang Digunakan
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{pkg.title}</h4>

                      {pkg.note && (
                        <p className="text-xs text-slate-500 italic">
                          Catatan: {pkg.note}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 pt-1">
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                          <strong>{pkg.questionsCount}</strong> Butir Soal
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-600" />
                          <strong>{pkg.durationMinutes}</strong> Menit
                        </span>
                        <span>•</span>
                        <span>
                          KKM: <strong>{pkg.kkm}</strong>
                        </span>
                        <span>•</span>
                        <span className="text-[11px] text-slate-400">
                          Disimpan: {new Date(pkg.savedAt).toLocaleDateString('id-ID', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                      <button
                        onClick={() =>
                          onCopyText(
                            `Kode: ${pkg.code} | Token: ${pkg.token}`,
                            `Kode & Token Paket ${pkg.code} Disalin!`
                          )
                        }
                        className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition"
                        title="Salin Kode Soal dan Token"
                      >
                        <Copy className="w-3.5 h-3.5 text-slate-500" />
                        <span>Salin Kode & Token</span>
                      </button>

                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Yakin ingin memuat paket soal "${pkg.title}"?\n\nSoal aktif, Kode Soal (${pkg.code}), dan Token Siswa (${pkg.token}) akan diperbarui sesuai paket ini.`
                            )
                          ) {
                            onLoad(pkg);
                          }
                        }}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-xs ${
                          isActive
                            ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                        }`}
                      >
                        <ArrowRight className="w-4 h-4" />
                        <span>{isActive ? 'Muat Ulang Paket' : 'Muat Paket Ini (Load)'}</span>
                      </button>

                      <button
                        onClick={() => {
                          if (confirm(`Yakin ingin menghapus paket soal "${pkg.title}" dari riwayat?`)) {
                            onDelete(pkg.id);
                          }
                        }}
                        className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-50 hover:text-rose-700 transition"
                        title="Hapus paket dari riwayat"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50 text-xs text-slate-500">
          <span>Semua paket tersimpan otomatis di browser &amp; disinkronkan ke Google Drive /Soal-Ujian.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-slate-700 hover:bg-slate-100 transition"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

/* ========================================================================= */
/* 3. SAVE PACKAGE TO HISTORY MODAL                                          */
/* ========================================================================= */
interface SavePackageModalProps {
  exam: Exam;
  totalScore: number;
  formData: { code: string; token: string; title: string; note: string };
  onChangeForm: (data: { code: string; token: string; title: string; note: string }) => void;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

const SavePackageModal: React.FC<SavePackageModalProps> = ({
  exam,
  totalScore,
  formData,
  onChangeForm,
  onSubmit,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700">
              <BookmarkPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Simpan ke Riwayat Paket Soal</h3>
              <p className="text-xs text-slate-500">
                Arsipkan butir soal, Kode Soal, dan Token Siswa untuk digunakan kembali.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 space-y-4 text-xs">
          {/* Summary Box */}
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">Total Soal</span>
              <span className="font-bold text-blue-700 text-sm">{exam.questions.length} Butir</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">Durasi</span>
              <span className="font-bold text-slate-800 text-sm">{exam.durationMinutes} Menit</span>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block uppercase font-bold">Total Poin</span>
              <span className="font-bold text-emerald-700 text-sm">{totalScore} Poin</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Kode Soal <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => onChangeForm({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="misal: IPA-09-01"
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-emerald-500 uppercase"
              />
              <span className="text-[10px] text-slate-400">Kode identitas unik paket naskah</span>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Token Siswa <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.token}
                onChange={(e) => onChangeForm({ ...formData, token: e.target.value.toUpperCase() })}
                placeholder="misal: BIO26"
                className="w-full p-2.5 rounded-xl border border-slate-300 font-mono font-bold focus:ring-2 focus:ring-emerald-500 uppercase"
              />
              <span className="text-[10px] text-slate-400">Token akses untuk pengerjaan siswa</span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Judul Paket Soal <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => onChangeForm({ ...formData, title: e.target.value })}
              placeholder="misal: Asesmen Sumatif IPA Bab 1: Sel dan Mikroskop"
              className="w-full p-2.5 rounded-xl border border-slate-300 font-medium focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Catatan / Keterangan Versi (Opsional)
            </label>
            <textarea
              rows={2}
              value={formData.note}
              onChange={(e) => onChangeForm({ ...formData, note: e.target.value })}
              placeholder="misal: Paket Soal Utama Ujian Semester Ganjil TA 2026/2027"
              className="w-full p-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs flex items-center gap-1.5 transition"
            >
              <Check className="w-4 h-4" />
              <span>Simpan Paket ke Riwayat</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
