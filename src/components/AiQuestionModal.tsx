import React, { useState } from 'react';
import {
  X,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  BookOpen,
  GraduationCap,
  Layers,
  FileQuestion,
  ListChecks,
  Check,
} from 'lucide-react';
import { Question, QuestionType, Exam } from '../types';
import { apiService } from '../services/api';

interface AiQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddQuestions?: (newQuestions: Question[]) => void;
  onQuestionsGenerated?: (newQuestions: Question[], topicInfo: { subject: string; grade: string; semester: string; goal: string; topic: string }) => void;
  exam?: Exam;
  defaultSubject?: string;
  defaultGrade?: string;
  defaultSemester?: string;
}

export const AiQuestionModal: React.FC<AiQuestionModalProps> = ({
  isOpen,
  onClose,
  onAddQuestions,
  onQuestionsGenerated,
  exam,
  defaultSubject = 'Ilmu Pengetahuan Alam (IPA)',
  defaultGrade = 'Kelas 9',
  defaultSemester = 'Ganjil',
}) => {
  const [subject, setSubject] = useState(exam?.subject || defaultSubject);
  const [grade, setGrade] = useState(exam?.grade || defaultGrade);
  const [semester, setSemester] = useState(exam?.semester || defaultSemester);
  const [educationGoal, setEducationGoal] = useState(
    exam?.educationGoal ||
      'Peserta didik mampu menganalisis mekanisme respirasi seluler, fungsi organel sel, dan konversi energi dalam fotosintesis.'
  );
  const [coreMaterial, setCoreMaterial] = useState(
    exam?.coreMaterial || 'Struktur dan Fungsi Organel Sel serta Metabolisme Fotosintesis'
  );
  const [difficulty, setDifficulty] = useState('Sedang (HOTS Konseptual)');
  const [count, setCount] = useState(5);
  const [customPrompt, setCustomPrompt] = useState(
    'Buatkan soal berbasis konteks kehidupan sehari-hari dengan stimulus teks atau data ilmiah ringkas. Buat kunci jawaban dan pembahasan yang mendidik.'
  );

  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>([
    'pilihan_ganda',
    'pilihan_ganda_kompleks',
    'isian_singkat',
    'uraian',
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedPreview, setGeneratedPreview] = useState<Question[] | null>(null);

  if (!isOpen) return null;

  const toggleType = (type: QuestionType) => {
    if (selectedTypes.includes(type)) {
      if (selectedTypes.length > 1) {
        setSelectedTypes(selectedTypes.filter((t) => t !== type));
      }
    } else {
      setSelectedTypes([...selectedTypes, type]);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const questions = await apiService.generateQuestions({
        subject,
        grade,
        semester,
        educationGoal,
        coreMaterial,
        difficulty,
        count,
        types: selectedTypes,
        customPrompt,
      });

      // Format questions with unique IDs
      const formatted: Question[] = questions.map((q: any, i: number) => ({
        id: `q-ai-${Date.now()}-${i}`,
        type: q.type || 'pilihan_ganda',
        question: q.question,
        options: Array.isArray(q.options) ? q.options : [],
        correctAnswer: q.correctAnswer,
        keywords: Array.isArray(q.keywords) ? q.keywords : [],
        concept: q.concept || coreMaterial,
        rubric: q.rubric || '',
        maxScore: Number(q.maxScore) || (q.type === 'uraian' ? 20 : 10),
        explanation: q.explanation || '',
      }));

      setGeneratedPreview(formatted);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal menghasilkan soal dengan AI. Pastikan Kunci API Gemini valid.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!generatedPreview) return;
    if (onAddQuestions) {
      onAddQuestions(generatedPreview);
    }
    if (onQuestionsGenerated) {
      onQuestionsGenerated(generatedPreview, {
        subject,
        grade,
        semester,
        goal: educationGoal,
        topic: coreMaterial,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white w-full max-w-3xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden my-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-700 via-violet-800 to-slate-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-amber-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Generator Soal AI Gemini
                <span className="bg-amber-400/20 text-amber-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-400/30">
                  Semua Format Soal
                </span>
              </h2>
              <p className="text-xs text-indigo-200">
                Otomatisasi butir soal berdasarkan kurikulum, tujuan pendidikan & kata kunci penilaian
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-xs max-h-[75vh] overflow-y-auto">
          {!generatedPreview ? (
            <div className="space-y-4">
              {/* Row 1: Subject, Grade, Semester */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    Mata Pelajaran
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Contoh: IPA, Matematika, dsb."
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <GraduationCap className="w-3.5 h-3.5 text-indigo-600" />
                    Tingkat / Kelas
                  </label>
                  <select
                    value={grade}
                    onChange={(e) => setGrade(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Kelas 7 (Fase D)">Kelas 7 SMP</option>
                    <option value="Kelas 8 (Fase D)">Kelas 8 SMP</option>
                    <option value="Kelas 9 (Fase D)">Kelas 9 SMP</option>
                    <option value="Kelas 10 (Fase E)">Kelas 10 SMA/SMK</option>
                    <option value="Kelas 11 (Fase F)">Kelas 11 SMA/SMK</option>
                    <option value="Kelas 12 (Fase F)">Kelas 12 SMA/SMK</option>
                    <option value="Kelas 4-6 (Fase C)">Kelas 4-6 SD</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-indigo-600" />
                    Semester
                  </label>
                  <select
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="Ganjil">Semester Ganjil</option>
                    <option value="Genap">Semester Genap</option>
                  </select>
                </div>
              </div>

              {/* Row 2: Education Goal & Core Material */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Tujuan Pembelajaran / Tujuan Pendidikan
                </label>
                <textarea
                  rows={2}
                  value={educationGoal}
                  onChange={(e) => setEducationGoal(e.target.value)}
                  placeholder="Contoh: Peserta didik mampu menjelaskan konsep..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Materi Pokok / Topik Bahasan
                </label>
                <input
                  type="text"
                  value={coreMaterial}
                  onChange={(e) => setCoreMaterial(e.target.value)}
                  placeholder="Contoh: Struktur Sel, Hukum Newton, Aljabar..."
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Row 3: Format Types Selection */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">
                  Bentuk Soal yang Dihasilkan:
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 'pilihan_ganda' as QuestionType, label: 'Pilihan Ganda', desc: '1 jawaban benar' },
                    { id: 'pilihan_ganda_kompleks' as QuestionType, label: 'PG Kompleks', desc: 'Multi-centang benar' },
                    { id: 'isian_singkat' as QuestionType, label: 'Isian Singkat', desc: 'Kata kunci otomatis' },
                    { id: 'uraian' as QuestionType, label: 'Uraian / Essay', desc: 'Rubrik konsep AI' },
                  ].map((t) => {
                    const active = selectedTypes.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => toggleType(t.id)}
                        className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                          active
                            ? 'bg-indigo-50/80 border-indigo-300 text-indigo-900 shadow-xs ring-1 ring-indigo-400'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[11px]">{t.label}</span>
                          <span
                            className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                              active ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-400'
                            }`}
                          >
                            ✓
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500 mt-1">{t.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: MENU JUMLAH SOAL & TINGKAT KESULITAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block font-bold text-slate-800 text-xs">
                      Menu Jumlah Soal
                    </label>
                    <span className="text-indigo-700 font-bold bg-indigo-100 px-2 py-0.5 rounded text-[11px]">
                      {count} Butir
                    </span>
                  </div>
                  {/* Preset Pills */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {[3, 5, 10, 15, 20, 25, 30].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setCount(n)}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition ${
                          count === n
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={1}
                      max={30}
                      value={count}
                      onChange={(e) => setCount(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 cursor-pointer"
                    />
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={count}
                      onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                      className="w-14 text-center font-bold px-1.5 py-1 rounded border border-slate-300 bg-white text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-800 mb-1.5 text-xs">
                    Tingkat Kesulitan / Kognitif
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-indigo-500 bg-white mb-1.5"
                  >
                    <option value="Mudah (C1-C2 Mengingat & Memahami)">Mudah (C1 - C2)</option>
                    <option value="Sedang (C3 Menerapkan)">Sedang (C3 Menerapkan)</option>
                    <option value="HOTS / Analisis (C4-C6 Menganalisis & Mengevaluasi)">HOTS / Sulit (C4 - C6)</option>
                    <option value="Campuran Bergradasi (Mudah, Sedang, HOTS)">Campuran Bergradasi (Standar)</option>
                  </select>
                  <span className="text-[10px] text-slate-500 leading-tight block">
                    Menentukan kompleksitas stimulus dan daya pembeda pilihan jawaban.
                  </span>
                </div>
              </div>

              {/* Row 5: MENU PROMPT & INSTRUKSI GURU */}
              <div className="bg-indigo-50/80 border border-indigo-200/80 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    Menu Prompt & Instruksi Khusus Guru
                  </label>
                  <span className="text-[10px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full font-medium">
                    Kustomisasi Gemini AI
                  </span>
                </div>

                {/* Preset Prompt Buttons */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    {
                      label: 'HOTS C4-C6',
                      text: 'Tingkatkan level penalaran HOTS C4-C6 dengan studi kasus berbasis data saintifik dan perbandingan.',
                    },
                    {
                      label: 'Konteks Indonesia',
                      text: 'Gunakan stimulus cerita kontekstual bertema lingkungan, budaya, atau kearifan lokal di Indonesia.',
                    },
                    {
                      label: 'Eksperimen Sains',
                      text: 'Sertakan stimulus hasil percobaan/eksperimen laboratorium dan tabel data observasi.',
                    },
                    {
                      label: 'Format Asesmen AKM',
                      text: 'Gaya asesmen literasi-numerasi Asesmen Kompetensi Minimum (AKM) dengan stimulus reflektif.',
                    },
                  ].map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setCustomPrompt(p.text)}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-white hover:bg-indigo-100 text-indigo-800 border border-indigo-200 transition font-medium"
                    >
                      + {p.label}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={2}
                  value={customPrompt}
                  onChange={(e) => setCustomPrompt(e.target.value)}
                  placeholder="Ketik instruksi tambahan untuk Gemini AI, misalnya: 'Sertakan stimulus tabel data', 'Fokus pada penalaran siswa', atau kutipan buku ajar..."
                  className="w-full text-xs p-2.5 rounded-lg border border-indigo-200 focus:ring-2 focus:ring-indigo-500 bg-white text-slate-800"
                />
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
              )}
            </div>
          ) : (
            /* Preview of Generated Questions */
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-center justify-between text-emerald-900">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <div>
                    <span className="font-bold block">
                      Berhasil Menghasilkan {generatedPreview.length} Butir Soal!
                    </span>
                    <span className="text-emerald-700 text-[11px]">
                      Lengkap dengan kunci jawaban, kata kunci konsep, dan rubrik penilaian AI.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setGeneratedPreview(null)}
                  className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-800 font-medium transition"
                >
                  Generate Ulang
                </button>
              </div>

              <div className="space-y-3">
                {generatedPreview.map((q, idx) => (
                  <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">
                        Soal #{idx + 1} •{' '}
                        <span className="uppercase text-indigo-600 font-semibold">
                          {q.type.replace(/_/g, ' ')}
                        </span>
                      </span>
                      <span className="text-[11px] font-semibold bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md">
                        Skor Maks: {q.maxScore}
                      </span>
                    </div>

                    <p className="text-slate-800 font-medium text-xs leading-relaxed">{q.question}</p>

                    {q.options.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-2 pt-1">
                        {q.options.map((opt, i) => (
                          <div key={i} className="text-[11px] text-slate-600 bg-white p-1.5 rounded border border-slate-200">
                            {opt}
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200/80 flex flex-wrap gap-2 text-[11px]">
                      <div className="bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                        Kunci: {Array.isArray(q.correctAnswer) ? q.correctAnswer.join(', ') : q.correctAnswer}
                      </div>

                      {q.keywords && q.keywords.length > 0 && (
                        <div className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                          Kata Kunci: {q.keywords.join(', ')}
                        </div>
                      )}

                      {q.rubric && (
                        <div className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded truncate max-w-xs">
                          Rubrik: {q.rubric}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between">
          <span className="text-slate-500 text-[11px] flex items-center gap-1">
            <HelpCircle className="w-3.5 h-3.5" />
            Model: <strong>gemini-3.8-flash</strong>
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-xl text-slate-600 hover:text-slate-800 hover:bg-slate-200 transition"
            >
              Tutup
            </button>

            {!generatedPreview ? (
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || !subject || !coreMaterial}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'AI Sedang Merumuskan Soal...' : 'Buat Soal Sekarang'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleApply}
                className="px-5 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan ke Bank Soal &amp; Drive</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
